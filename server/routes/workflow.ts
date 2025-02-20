import { Router } from "express";
import multer from "multer";
import debug from 'debug';
import { db } from "../db";
import { vaultDocuments, metricsEvents, documentAnalysis } from "@shared/schema";
import { analyzeDocument } from "../services/documentAnalysisService";
import { processDocument } from "../services/documentProcessor";
import { createVectorEmbedding } from "../services/vectorService";

const log = debug('jurysync:workflow');

// Configure multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
}).single('file'); // Move single() to the multer config

const router = Router();

router.post("/upload", (req, res) => {
  log('Received upload request');

  upload(req, res, async (err) => {
    const startTime = Date.now();

    try {
      // Handle multer errors
      if (err) {
        log('Upload error: %o', err);
        return res.status(400).json({
          error: err instanceof multer.MulterError ? 'File upload error' : 'Invalid file',
          details: err.message
        });
      }

      // Check if file exists in request
      if (!req.file) {
        log('No file in request');
        return res.status(400).json({
          error: 'No file uploaded',
          details: 'Request must include a file in the "file" field'
        });
      }

      log('Processing file: %o', {
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      // Process the document
      const processResult = await processDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      if (!processResult.success || !processResult.content) {
        log('Document processing failed: %o', { error: processResult.error });
        return res.status(400).json({
          error: 'Failed to process document',
          details: processResult.error
        });
      }

      // Generate vector embedding for search
      log('Document processed successfully, generating vector embedding');
      const vectorEmbedding = await createVectorEmbedding(processResult.content);

      // Run AI analysis
      log('Running AI analysis');
      const analysis = await analyzeDocument(processResult.content);

      // Store document in database
      log('Storing document in database');
      const [document] = await db.transaction(async (tx) => {
        const [doc] = await tx
          .insert(vaultDocuments)
          .values({
            userId: 1, // Default to 1 since we're removing session dependency
            title: req.file!.originalname,
            content: processResult.content,
            documentType: analysis.documentType || 'OTHER',
            fileSize: req.file!.size,
            mimeType: req.file!.mimetype,
            aiSummary: analysis.summary,
            aiClassification: analysis.classification,
            vectorId: vectorEmbedding.id,
            metadata: {
              ...processResult.metadata,
              keywords: analysis.keywords,
              confidence: analysis.confidence,
              entities: analysis.entities
            }
          })
          .returning();

        // Store analysis results
        await tx.insert(documentAnalysis).values({
          documentId: doc.id,
          documentType: doc.documentType,
          industry: analysis.industry || 'UNKNOWN',
          complianceStatus: analysis.complianceStatus,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        return [doc];
      });

      log('Upload completed successfully: %o', {
        documentId: document.id,
        processingTime: Date.now() - startTime
      });

      res.json({
        status: 'success',
        documentId: document.id,
        text: processResult.content,
        metadata: {
          ...processResult.metadata,
          extractionQuality: analysis.confidence,
          processingTime: Date.now() - startTime
        },
        analysis: {
          ...analysis,
          vectorId: vectorEmbedding.id
        }
      });

    } catch (error) {
      log('Error during document processing: %o', error);

      res.status(500).json({
        error: 'Failed to process document',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
    }
  });
});

export default router;