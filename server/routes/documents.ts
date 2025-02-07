import { Router } from "express";
import multer from "multer";
import { generateContractDraft } from "../services/openai";
import { db } from "../db";
import { documents } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Generate contract draft
router.post("/api/documents/generate", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { templateType, requirements, customInstructions } = req.body;

    if (!templateType || !requirements || !Array.isArray(requirements)) {
      return res.status(400).json({
        error: "Missing or invalid required fields",
        code: "VALIDATION_ERROR"
      });
    }

    // Generate draft using OpenAI
    const content = await generateContractDraft({
      templateType,
      requirements,
      customInstructions,
      userId: req.user!.id
    });

    // Create document record
    const [document] = await db
      .insert(documents)
      .values({
        userId: req.user!.id,
        content,
        processingStatus: "COMPLETED",
        agentType: "CONTRACT_AUTOMATION"
      })
      .returning();

    res.json({
      id: document.id,
      content,
      message: "Contract draft generated successfully"
    });

  } catch (error: any) {
    console.error("Generation error:", error);
    res.status(500).json({
      error: error.message || "Failed to generate contract",
      code: "GENERATION_ERROR"
    });
  }
});

// Upload document
router.post("/api/documents", upload.single('file'), async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded",
        code: "VALIDATION_ERROR"
      });
    }

    const content = req.file.buffer.toString('utf-8');
    const title = req.file.originalname;

    // Create document record
    const [document] = await db
      .insert(documents)
      .values({
        userId: req.user!.id,
        content,
        title,
        processingStatus: "COMPLETED",
        agentType: "CONTRACT_AUTOMATION"
      })
      .returning();

    res.status(201).json({
      id: document.id,
      message: "Document uploaded successfully"
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({
      error: error.message || "Failed to upload document",
      code: "UPLOAD_ERROR"
    });
  }
});

export default router;