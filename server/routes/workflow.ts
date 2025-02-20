import { Router } from "express";
import multer from "multer";
import debug from 'debug';
import { db } from "../db";
import { vaultDocuments, documentAnalysis } from "@shared/schema";
import { analyzeDocument } from "../services/documentAnalysisService";
import { processDocument } from "../services/documentProcessor";
import { createVectorEmbedding } from "../services/vectorService";

const log = debug('jurysync:workflow');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
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

      // Process document
      const processResult = await processDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      if (!processResult.success || !processResult.content) {
        throw new Error(processResult.error || 'Failed to process document');
      }

      // Generate vector embedding
      const vectorEmbedding = await createVectorEmbedding(processResult.content);

      // Analyze document
      const analysis = await analyzeDocument(processResult.content);

      // Store in database
      const [document] = await db.transaction(async (tx) => {
        const [doc] = await tx
          .insert(vaultDocuments)
          .values({
            userId: 1, // Default user ID
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

      res.json({
        success: true,
        documentId: document.id,
        analysis: {
          ...analysis,
          vectorId: vectorEmbedding.id
        }
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

export default router;