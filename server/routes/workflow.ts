import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { vaultDocuments, metricsEvents, documentAnalysis } from "@shared/schema";
import { analyzeDocument } from "../services/documentAnalysisService";
import { processDocument } from "../services/documentProcessor";
import { createVectorEmbedding } from "../services/vectorService";

// Configure multer with proper limits and file filtering
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX and TXT files are allowed.'));
      return;
    }
    cb(null, true);
  }
});

const router = Router();

router.post("/upload", upload.single("file"), async (req, res) => {
  const startTime = Date.now();
  console.log("Processing upload request:", {
    filename: req.file?.originalname,
    size: req.file?.size,
    type: req.file?.mimetype
  });

  try {
    // Validate file presence
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Process document content
    const processResult = await processDocument(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    if (!processResult.success || !processResult.content) {
      return res.status(400).json({
        error: "Failed to process document",
        details: processResult.error
      });
    }

    // Generate vector embedding for similarity search
    const vectorEmbedding = await createVectorEmbedding(processResult.content);

    // Get AI insights
    const analysis = await analyzeDocument(processResult.content);

    // Store document in vault with transaction
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
          processingMethod: processResult.metadata?.method
        }
      });

      return [doc];
    });

    // Return success response
    res.json({
      status: 'success',
      documentId: document.id,
      text: processResult.content,
      metadata: processResult.metadata,
      analysis
    });

  } catch (error) {
    console.error("Error processing document:", error);

    // Track error metrics
    if (req.session?.userId) {
      await db.insert(metricsEvents).values({
        userId: req.session.userId,
        modelId: 'document-analysis',
        taskType: 'DOCUMENT_UPLOAD',
        processingTimeMs: Date.now() - startTime,
        successful: false,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }

    // Return appropriate error response
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: "File upload error: " + error.message });
    }

    if (error instanceof Error && error.message.includes('Invalid file type')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to process document. Please try again." });
  }
});

export default router;