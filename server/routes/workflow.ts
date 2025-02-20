import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { vaultDocuments, metricsEvents, documentAnalysis } from "@shared/schema";
import { analyzeDocument } from "../services/documentAnalysisService";
import { createVectorEmbedding } from "../services/vectorService";

// Configure multer with proper limits and file filtering
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'text/plain', 
                         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
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

  try {
    // Validate file presence
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Validate session and user
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Extract content based on file type
    const content = req.file.buffer.toString('utf-8');

    // Generate vector embedding for similarity search
    const vectorEmbedding = await createVectorEmbedding(content);

    // Get AI insights using our document analysis service
    const analysis = await analyzeDocument(content);

    // Store document in vault with transaction
    const [document] = await db.transaction(async (tx) => {
      // Insert document
      const [doc] = await tx
        .insert(vaultDocuments)
        .values({
          userId,
          title: req.file.originalname,
          content,
          documentType: analysis.classification || 'OTHER',
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          aiSummary: analysis.summary,
          aiClassification: analysis.classification,
          vectorId: vectorEmbedding.id,
          metadata: {
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
        complianceStatus: {
          status: analysis.complianceStatus || 'PENDING',
          details: analysis.complianceDetails || '',
          lastChecked: new Date().toISOString()
        }
      });

      // Track metrics
      await tx.insert(metricsEvents).values({
        userId,
        modelId: 'document-analysis',
        taskType: 'DOCUMENT_UPLOAD',
        processingTimeMs: Date.now() - startTime,
        successful: true,
        costSavingEstimate: analysis.costSavings || 0
      });

      return [doc];
    });

    // Return success response
    res.json({
      status: 'success',
      documentId: document.id,
      text: content,
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
        successful: false
      });
    }

    // Return appropriate error response
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: "File upload error: " + error.message });
    }

    if (error.message.includes('Invalid file type')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to process document. Please try again." });
  }
});

export default router;