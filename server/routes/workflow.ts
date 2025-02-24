import { Router } from "express";
import multer from "multer";
import debug from 'debug';
import { db } from "../db";
import { vaultDocuments } from "@shared/schema";
import { processDocument } from "../services/document-processor";
import { createVectorEmbedding } from "../services/vectorService";
import { eq } from 'drizzle-orm';

const log = debug('jurysync:workflow');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
    files: 1
  }
}).single('file');

const router = Router();

// Health check endpoint
router.get("/health", (req, res) => {
  try {
    log('Health check requested');
    res.json({ 
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log('Health check failed:', error);
    res.status(500).json({ 
      status: 'error',
      error: error instanceof Error ? error.message : 'Health check failed'
    });
  }
});

// Test route for basic file upload
router.post("/test-upload", (req, res) => {
  upload(req, res, async (err) => {
    try {
      if (err) {
        log('Upload error:', err);
        return res.status(400).json({
          success: false,
          error: err.message || 'File upload failed'
        });
      }

      if (!req.file) {
        log('No file received');
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Log detailed file information
      log('File received:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        encoding: req.file.encoding,
        mimetype: req.file.mimetype,
        size: req.file.size,
        buffer_length: req.file.buffer.length
      });

      // Basic content extraction
      const content = req.file.buffer.toString('utf-8');

      // Log content details
      log('Content extracted:', {
        length: content.length,
        preview: content.substring(0, 100)
      });

      return res.json({
        success: true,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        content_length: content.length,
        content_preview: content.substring(0, 100)
      });

    } catch (error: any) {
      log('Test upload error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Upload processing failed',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });
});

// Main upload route with full processing
router.post("/upload", (req, res) => {
  upload(req, res, async (err) => {
    try {
      if (err) {
        log('Upload error:', err);
        return res.status(400).json({
          success: false,
          error: err.message || 'File upload failed'
        });
      }

      if (!req.file) {
        log('No file received');
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Log detailed file information
      log('File received:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        encoding: req.file.encoding,
        mimetype: req.file.mimetype,
        size: req.file.size,
        buffer_length: req.file.buffer.length
      });

      // Basic content check first
      let content = '';
      try {
        content = req.file.buffer.toString('utf-8');
      } catch (error) {
        log('Content extraction error:', error);
        return res.status(400).json({
          success: false,
          error: 'Failed to extract file content'
        });
      }

      // Store document in database
      const [document] = await db
        .insert(vaultDocuments)
        .values({
          userId: req.user?.id || 1,
          title: req.file.originalname,
          content: content,
          documentType: 'PENDING',
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          metadata: {
            uploadTimestamp: new Date().toISOString()
          },
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      log('Document stored:', { id: document.id });

      // Process document in background
      setTimeout(async () => {
        try {
          const processResult = await processDocument(
            req.file!.buffer,
            req.file!.originalname,
            req.file!.mimetype
          );

          if (processResult.success) {
            await db
              .update(vaultDocuments)
              .set({
                content: processResult.content,
                documentType: 'PROCESSED',
                metadata: {
                  ...document.metadata,
                  processed: true,
                  processingTime: processResult.metadata?.processingTime
                }
              })
              .where(eq(vaultDocuments.id, document.id));

            // Create vector embedding
            createVectorEmbedding(processResult.content)
              .then(async (embedding) => {
                await db
                  .update(vaultDocuments)
                  .set({ vectorId: embedding.id })
                  .where(eq(vaultDocuments.id, document.id));
                log('Vector embedding created for document:', document.id);
              })
              .catch(error => log('Vector embedding error:', error));
          }
        } catch (error) {
          log('Background processing error:', error);
        }
      }, 0);

      // Return immediate success response
      return res.json({
        success: true,
        documentId: document.id,
        text: content.substring(0, 1000), // Send preview only
        status: 'processing'
      });

    } catch (error: any) {
      log('Upload processing error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Upload processing failed',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });
});

// Status check route
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
      documentType: document.documentType,
      metadata: document.metadata,
      aiSummary: document.aiSummary,
      aiClassification: document.aiClassification
    });

  } catch (error) {
    log('Status check error:', error);
    res.status(500).json({
      error: 'Failed to check document status'
    });
  }
});

export default router;