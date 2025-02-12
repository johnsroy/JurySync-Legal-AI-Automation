import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { vaultDocuments } from "@shared/schema";
import { analyzeDocument } from "../services/documentAnalysisService";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.session.userId;
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
        title: req.file.originalname,
        content,
        documentType: analysis.classification,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        aiSummary: analysis.summary,
        aiClassification: analysis.classification,
        metadata: {
          keywords: analysis.keywords,
          confidence: analysis.confidence,
          entities: analysis.entities
        },
        userId
      })
      .returning();

    // Return both the document content and metadata
    res.json({
      status: 'success',
      documentId: document.id,
      text: content,
      analysis
    });
  } catch (error) {
    console.error("Error processing document:", error);
    res.status(500).json({ error: "Failed to process document" });
  }
});

export default router;
