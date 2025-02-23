import { Router } from "express";
import multer from "multer";
import debug from 'debug';
import { db } from "../db";
import { vaultDocuments } from "@shared/schema";
import { processDocument } from "../services/documentProcessor";
import { workflowOrchestrator } from "../services/workflowOrchestrator";
import { createVectorEmbedding } from "../services/vectorService";
import { eq } from 'drizzle-orm';

const log = debug('jurysync:workflow');

// Configure multer for multiple files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit per file
    files: 10 // Maximum 10 files per batch
  }
}).array('files', 10);

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

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded'
      });
    }

    try {
      log('Processing batch upload:', {
        fileCount: req.files.length,
        files: req.files.map(f => ({
          filename: f.originalname,
          mimetype: f.mimetype,
          size: f.size
        }))
      });

      // Process all files in parallel
      const processPromises = req.files.map(async (file) => {
        try {
          // Initial document processing
          const processResult = await processDocument(
            file.buffer,
            file.originalname,
            file.mimetype
          );

          if (!processResult.success || !processResult.content) {
            throw new Error(processResult.error || 'Failed to process document');
          }

          // Store document in database
          const [document] = await db
            .insert(vaultDocuments)
            .values({
              title: file.originalname,
              content: processResult.content,
              documentType: 'pending',
              fileSize: file.size,
              mimeType: file.mimetype,
              status: 'processing',
              metadata: {
                ...processResult.metadata,
                batchUpload: true,
                uploadTimestamp: new Date().toISOString()
              }
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

          return {
            success: true,
            documentId: document.id,
            filename: file.originalname
          };
        } catch (error) {
          return {
            success: false,
            filename: file.originalname,
            error: error instanceof Error ? error.message : 'Processing failed'
          };
        }
      });

      // Wait for all files to be processed
      const results = await Promise.all(processPromises);

      // Group results by success/failure
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      res.json({
        success: true,
        message: 'Batch upload processed',
        totalFiles: req.files.length,
        successfulUploads: successful.length,
        failedUploads: failed.length,
        documents: successful.map(s => ({
          documentId: s.documentId,
          filename: s.filename,
          status: 'processing'
        })),
        failures: failed.map(f => ({
          filename: f.filename,
          error: f.error
        }))
      });

    } catch (error) {
      log('Batch upload error:', error);
      res.status(500).json({
        error: 'Failed to process batch upload',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
});

router.get("/batch-status", async (req, res) => {
  try {
    const documentIds = req.query.ids;

    if (!documentIds || !Array.isArray(documentIds)) {
      return res.status(400).json({
        error: 'Invalid document IDs provided'
      });
    }

    const documents = await db
      .select()
      .from(vaultDocuments)
      .where(
        eq(vaultDocuments.id, documentIds.map(id => parseInt(id as string)))
      );

    const statusSummary = {
      total: documents.length,
      processing: documents.filter(d => d.status === 'processing').length,
      completed: documents.filter(d => d.status === 'completed').length,
      failed: documents.filter(d => d.status === 'failed').length,
      documents: documents.map(d => ({
        documentId: d.id,
        status: d.status,
        documentType: d.documentType,
        metadata: d.metadata
      }))
    };

    res.json(statusSummary);

  } catch (error) {
    log('Batch status check error:', error);
    res.status(500).json({
      error: 'Failed to check batch status'
    });
  }
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