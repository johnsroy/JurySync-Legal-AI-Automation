import { Router } from "express";
import multer from "multer";
import { generateContract } from "../services/openai";
import { db } from "../db";
import { documents } from "@shared/schema";

const router = Router();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Generate contract
router.post("/api/documents/generate", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { templateType, requirements, customInstructions } = req.body;

    if (!templateType || !requirements || !Array.isArray(requirements)) {
      return res.status(400).send("Missing template type or requirements");
    }

    // Generate contract text
    const contractText = await generateContract(
      templateType,
      requirements,
      customInstructions
    );

    // Save to database
    const [document] = await db
      .insert(documents)
      .values({
        userId: req.user!.id,
        content: contractText,
        processingStatus: "COMPLETED",
        agentType: "CONTRACT_AUTOMATION"
      })
      .returning();

    // Send simple response
    res.send({
      id: document.id,
      content: contractText
    });

  } catch (error: any) {
    console.error("Generation error:", error);
    res.status(500).send(error.message || "Failed to generate contract");
  }
});

// Upload document
router.post("/api/documents", upload.single('file'), async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const content = req.file.buffer.toString('utf-8');

    // Save to database
    const [document] = await db
      .insert(documents)
      .values({
        userId: req.user!.id,
        content: content,
        processingStatus: "COMPLETED",
        agentType: "DOCUMENT_UPLOAD"
      })
      .returning();

    res.send({
      id: document.id,
      content: content
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).send(error.message || "Failed to upload document");
  }
});

export default router;