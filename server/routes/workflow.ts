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
  },
  fileFilter: (req, file, cb) => {
    log('Multer processing file: %o', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error(`Invalid file type. Only PDF, DOC, DOCX and TXT files are allowed. Got: ${file.mimetype}`);
      log('File type rejected: %s', file.mimetype);
      return cb(error);
    }

    const fileName = file.originalname.toLowerCase();
    const validExtensions = ['.pdf', '.doc', '.docx', '.txt'];

    if (!validExtensions.some(ext => fileName.endsWith(ext))) {
      const error = new Error('Invalid file extension');
      log('File extension rejected: %s', fileName);
      return cb(error);
    }

    cb(null, true);
  }
});

const router = Router();

router.post("/upload", (req, res) => {
  log('Received upload request');

  upload.single('file')(req, res, async (err) => {
    const startTime = Date.now();

    if (err instanceof multer.MulterError) {
      log('Multer error: %o', err);
      return res.status(400).json({
        error: 'File upload error',
        details: err.message,
        code: err.code
      });
    } else if (err) {
      log('Upload error: %o', err);
      return res.status(400).json({
        error: err.message || 'File upload failed',
        details: err instanceof Error ? err.stack : undefined
      });
    }

    if (!req.file) {
      log('No file in request');
      return res.status(400).json({
        error: 'No file uploaded',
        details: 'Request must include a file'
      });
    }

    try {
      log('Starting document processing: %o', {
        filename: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
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
            userId: req.session?.userId || 1,
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

      // Log error metrics -  RE-ADDED THIS SECTION
      await db.insert(metricsEvents).values({
        userId: req.session?.userId, // handles undefined case
        modelId: 'document-analysis',
        taskType: 'DOCUMENT_UPLOAD',
        processingTimeMs: Date.now() - startTime,
        successful: false,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          filename: req.file?.originalname,
          fileType: req.file?.mimetype
        }
      });


      res.status(500).json({
        error: 'Failed to process document',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: error instanceof Error ? error.stack : undefined
      });
    }
  });
});

export default router;