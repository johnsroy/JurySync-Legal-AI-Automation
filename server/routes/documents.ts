import { Router } from "express";
import { generateContractDraft, analyzeContractClauses } from "../services/openai";
import { db } from "../db";
import { documents } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

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
    const [document] = await db.insert(documents)
      .values({
        title: `${templateType} Contract Draft`,
        content: content,
        userId: req.user!.id,
        agentType: 'CONTRACT_AUTOMATION',
        processingStatus: "COMPLETED"
      })
      .returning();

    res.json({
      id: document.id,
      content: content,
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
router.post("/api/documents", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        error: "Missing required fields",
        code: "VALIDATION_ERROR"
      });
    }

    // Create document record
    const [document] = await db.insert(documents)
      .values({
        title,
        content: Buffer.from(content).toString(),
        userId: req.user!.id,
        agentType: 'CONTRACT_AUTOMATION',
        processingStatus: "COMPLETED"
      })
      .returning();

    res.status(201).json(document);

  } catch (error: any) {
    console.error("Document upload error:", error);
    res.status(500).json({
      error: error.message || "Failed to upload document",
      code: "UPLOAD_ERROR"
    });
  }
});

export default router;