import { Router } from "express";
import multer from "multer";
import debug from 'debug';
import { db } from "../db";
import { vaultDocuments, documentAnalysis } from "@shared/schema";
import { processDocument } from "../services/documentProcessor";
import { workflowOrchestrator } from "../services/workflowOrchestrator";
import { createVectorEmbedding } from "../services/vectorService";

const log = debug('jurysync:workflow');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // Increased to 20MB limit
  }
}).single('file');

const router = Router();

router.post("/upload", (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      log('Upload error:', err);
      return res.status(400).json({
        error: 'File upload error',
        details: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        details: 'Please provide a file'
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

      if (!processResult.success || !processResult.content) {
        throw new Error(processResult.error || 'Failed to process document');
      }

      // Store initial document and create vector embedding
      const [document] = await db.transaction(async (tx) => {
        // Store document
        const [doc] = await tx
          .insert(vaultDocuments)
          .values({
            userId: 1, // Default user ID
            title: req.file!.originalname,
            content: processResult.content,
            documentType: processResult.metadata?.analysis?.documentType || 'UNKNOWN',
            fileSize: req.file!.size,
            mimeType: req.file!.mimetype,
            status: 'processing',
            metadata: processResult.metadata
          })
          .returning();

        // Create vector embedding
        const vectorEmbedding = await createVectorEmbedding(processResult.content);

        // Initialize analysis record
        await tx.insert(documentAnalysis).values({
          documentId: doc.id,
          documentType: doc.documentType,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
          vectorId: vectorEmbedding.id
        });

        return [doc];
      });

      // Start async workflow processing
      workflowOrchestrator.processDocument(document.id)
        .catch(error => {
          log('Async workflow processing error:', error);
          // Update document status to failed
          db.update(vaultDocuments)
            .set({ status: 'failed' })
            .where({ id: document.id })
            .catch(updateError => {
              log('Failed to update document status:', updateError);
            });
        });

      // Return initial response
      res.json({
        success: true,
        documentId: document.id,
        status: 'processing',
        message: 'Document uploaded and processing started'
      });

    } catch (error) {
      log('Processing error:', error);
      res.status(500).json({
        error: 'Failed to process document',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
});

// Add endpoint to check document processing status
router.get("/status/:documentId", async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);

    const [document] = await db
      .select()
      .from(vaultDocuments)
      .where({ id: documentId });

    if (!document) {
      return res.status(404).json({
        error: 'Document not found'
      });
    }

    res.json({
      documentId: document.id,
      status: document.status,
      metadata: document.metadata
    });

  } catch (error) {
    log('Status check error:', error);
    res.status(500).json({
      error: 'Failed to check document status'
    });
  }
});

// Add endpoint to get processing diagnostics
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