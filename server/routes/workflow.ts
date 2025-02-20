import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { vaultDocuments, type VaultDocument } from "@shared/schema";
import { analyzeDocument } from "../services/documentAnalysisService";
import { metricsEvents } from "@shared/schema";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const router = Router();

router.post("/upload", upload.single("file"), async (req, res) => {
  const startTime = Date.now();

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const content = req.file.buffer.toString('utf-8');

    // Get AI insights using our document analysis service
    const analysis = await analyzeDocument(content);

    // Store document in vault storage
    const [document] = await db
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
        metadata: {
          keywords: analysis.keywords,
          confidence: analysis.confidence,
          entities: analysis.entities
        }
      })
      .returning();

    // Track metrics
    await db.insert(metricsEvents).values({
      userId,
      modelId: 'document-analysis',
      taskType: 'DOCUMENT_UPLOAD',
      processingTimeMs: Date.now() - startTime,
      successful: true,
      costSavingEstimate: analysis.costSavings || 0
    });

    // Return both the document content and metadata
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

    res.status(500).json({ error: "Failed to process document" });
  }
});

export default router;