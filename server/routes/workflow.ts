import { Router } from "express";
import multer from "multer";
import debug from 'debug';
import { db } from "../db";
import { vaultDocuments } from "@shared/schema";
import { processDocument } from "../services/documentProcessor";
import { workflowOrchestrator } from "../services/workflowOrchestrator";
import { createVectorEmbedding } from "../services/vectorService";
import { eq } from 'drizzle-orm'; // Assuming this is the ORM used

const log = debug('jurysync:workflow');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit
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
        error: 'No file uploaded'
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

      // Store document in database
      const [document] = await db
        .insert(vaultDocuments)
        .values({
          title: req.file.originalname,
          content: processResult.content,
          documentType: 'pending',
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          status: 'processing',
          metadata: processResult.metadata || {}
        })
        .returning();

      // Create vector embedding in background
      createVectorEmbedding(processResult.content)
        .then(async (vectorEmbedding) => {
          await db
            .update(vaultDocuments)
            .set({ vectorId: vectorEmbedding.id })
            .where(eq(vaultDocuments.id, document.id));
        })
        .catch(error => {
          log('Vector embedding error:', error);
        });

      // Start workflow processing
      workflowOrchestrator.processDocument(document.id)
        .catch(error => {
          log('Workflow processing error:', error);
        });

      // Return initial response
      res.json({
        success: true,
        documentId: document.id,
        status: 'processing',
        message: 'Document uploaded and processing started'
      });

    } catch (error) {
      log('Upload processing error:', error);
      res.status(500).json({
        error: 'Failed to process upload',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
});

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