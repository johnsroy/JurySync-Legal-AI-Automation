import { Router } from "express";
import multer from "multer";
import debug from 'debug';
import { db } from "../db";
import { vaultDocuments, metricsEvents, documentAnalysis } from "@shared/schema";
import { analyzeDocument } from "../services/documentAnalysisService";
import { processDocument } from "../services/documentProcessor";
import { createVectorEmbedding } from "../services/vectorService";

const log = debug('jurysync:workflow');

// Configure multer with memory storage and strict file filtering
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    log('Processing uploaded file: %o', {
      filename: file.originalname,
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
      log('Rejected file type: %s', file.mimetype);
      cb(new Error(`Invalid file type. Only PDF, DOC, DOCX and TXT files are allowed. Got: ${file.mimetype}`));
      return;
    }

    const fileName = file.originalname.toLowerCase();
    const validExtensions = ['.pdf', '.doc', '.docx', '.txt'];

    if (!validExtensions.some(ext => fileName.endsWith(ext))) {
      log('Rejected file extension: %s', fileName);
      cb(new Error('Invalid file extension'));
      return;
    }

    cb(null, true);
  }
});

const router = Router();

router.post("/upload", upload.single("file"), async (req, res) => {
  const startTime = Date.now();

  log('Received upload request: %o', {
    filename: req.file?.originalname,
    contentType: req.headers['content-type']
  });

  try {
    if (!req.file) {
      log('No file in request');
      return res.status(400).json({ 
        error: "No file uploaded"
      });
    }

    log('Processing file: %s', req.file.originalname);

    // Process document content
    const processResult = await processDocument(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    if (!processResult.success || !processResult.content) {
      log('Document processing failed: %o', { error: processResult.error });
      return res.status(400).json({
        error: "Failed to process document",
        details: processResult.error
      });
    }

    // Generate vector embedding
    log('Generating vector embedding');
    const vectorEmbedding = await createVectorEmbedding(processResult.content);

    // Run AI analysis
    log('Running document analysis');
    const analysis = await analyzeDocument(processResult.content);

    // Store document with transaction
    log('Storing document in database');
    const [document] = await db.transaction(async (tx) => {
      // Insert document
      const [doc] = await tx
        .insert(vaultDocuments)
        .values({
          userId: req.session?.userId || 1, // Temporary fix for demo
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

      // Track metrics
      await tx.insert(metricsEvents).values({
        userId: req.session?.userId || 1,
        modelId: 'document-analysis',
        taskType: 'DOCUMENT_UPLOAD',
        processingTimeMs: Date.now() - startTime,
        successful: true,
        metadata: {
          documentId: doc.id,
          documentType: doc.documentType,
          processingMethod: processResult.metadata?.method,
          fileSize: req.file!.size
        }
      });

      return [doc];
    });

    log('Upload processing completed: %o', {
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
    log('Error processing document: %o', error);

    // Track error metrics
    if (req.session?.userId) {
      await db.insert(metricsEvents).values({
        userId: req.session.userId,
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
    }

    if (error instanceof multer.MulterError) {
      return res.status(400).json({ 
        error: "File upload error",
        details: error.message,
        code: error.code
      });
    }

    if (error instanceof Error && error.message.includes('Invalid file type')) {
      return res.status(400).json({ 
        error: error.message,
        allowedTypes: ['PDF', 'DOC', 'DOCX', 'TXT']
      });
    }

    res.status(500).json({ 
      error: "Failed to process document",
      message: error instanceof Error ? error.message : "An unexpected error occurred"
    });
  }
});

export default router;