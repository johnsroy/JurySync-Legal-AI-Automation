import { Router } from "express";
import multer from "multer";
import debug from 'debug';
import { db } from "../db";
import { vaultDocuments } from "@shared/schema";
import { processDocument } from "../services/document-processor";
import { workflowOrchestrator } from "../services/workflowOrchestrator";
import { createVectorEmbedding } from "../services/vectorService";
import { eq } from 'drizzle-orm';

const log = debug('jurysync:workflow');

// Configure multer with file filtering and better error handling
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit per file
    files: 1 // Single file upload
  },
  fileFilter: (req, file, cb) => {
    log('Received file:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    // Accept common document formats
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      log('File rejected - unsupported type:', file.mimetype);
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
}).single('file'); // Match frontend FormData field name

const router = Router();

router.post("/upload", (req, res) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      log('Multer error:', err);
      return res.status(400).json({
        error: 'File upload error',
        details: err.message,
        code: err.code
      });
    }

    if (err) {
      log('Upload error:', err);
      return res.status(400).json({
        error: 'File upload error',
        details: err.message
      });
    }

    if (!req.file) {
      log('No file received');
      return res.status(400).json({
        error: 'No file uploaded',
        details: 'Please select a file to upload'
      });
    }

    try {
      log('Processing file:', {
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      // Initial document processing
      const processResult = await processDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      log('Document processing result:', {
        success: processResult.success,
        hasContent: !!processResult.content,
        error: processResult.error
      });

      if (!processResult.success || !processResult.content) {
        throw new Error(processResult.error || 'Failed to process document');
      }

      // Store document in database
      const [document] = await db
        .insert(vaultDocuments)
        .values({
          content: processResult.content,
          title: req.file.originalname,
          documentType: processResult.metadata?.analysis?.documentType || 'UNKNOWN',
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          metadata: {
            ...processResult.metadata,
            uploadTimestamp: new Date().toISOString()
          }
        })
        .returning();

      log('Document stored in database:', {
        id: document.id,
        title: document.title
      });

      // Create vector embedding in background
      createVectorEmbedding(processResult.content)
        .then(async (vectorEmbedding) => {
          await db
            .update(vaultDocuments)
            .set({ vectorId: vectorEmbedding.id })
            .where(eq(vaultDocuments.id, document.id));

          log('Vector embedding created:', {
            documentId: document.id,
            vectorId: vectorEmbedding.id
          });
        })
        .catch(error => {
          log('Vector embedding error:', error);
        });

      // Start workflow processing
      workflowOrchestrator.processDocument(document.id)
        .catch(error => {
          log('Workflow processing error:', error);
        });

      // Return successful response with parsed text
      res.json({
        success: true,
        documentId: document.id,
        text: processResult.content,
        status: 'processing',
        message: 'Document uploaded and processing started'
      });

    } catch (error: any) {
      log('Upload processing error:', error);
      res.status(500).json({
        error: 'Failed to process upload',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      });
    }
  });
});

// Keep existing routes
router.get("/status/:documentId", async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);

    const [document] = await db
      .select()
      .from(vaultDocuments)
      .where(eq(vaultDocuments.id, documentId));

    if (!document) {
      return res.status(404).json({
        error: 'Document not found'
      });
    }

    res.json({
      documentId: document.id,
      status: document.status,
      documentType: document.documentType,
      metadata: document.metadata
    });

  } catch (error) {
    log('Status check error:', error);
    res.status(500).json({
      error: 'Failed to check document status'
    });
  }
});

router.get("/diagnostics/:documentId", async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const report = await workflowOrchestrator.getDiagnosticReport(documentId);
    res.json(report);
  } catch (error) {
    log('Diagnostics error:', error);
    res.status(500).json({
      error: 'Failed to generate diagnostics'
    });
  }
});

export default router;