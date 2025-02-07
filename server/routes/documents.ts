import { Router } from "express";
import { generateContract } from "../services/openai";
import { getAllTemplates, getTemplate } from "../services/templateStore";
import { db } from "../db";
import { documents } from "@shared/schema";
import { z } from "zod";
import multer from "multer";

const router = Router();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Get all available templates
router.get("/api/templates", async (req, res) => {
  try {
    console.log("Fetching templates...");
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const templates = getAllTemplates();
    console.log("Templates fetched:", templates);
    return res.json(templates);
  } catch (error: any) {
    console.error("Template fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// Get specific template details
router.get("/api/templates/:id", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const template = getTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    return res.json(template);
  } catch (error: any) {
    console.error("Template fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch template" });
  }
});

// Generate contract from template
router.post("/api/documents/generate", async (req, res) => {
  try {
    const { templateId, requirements, customInstructions } = req.body;

    if (!templateId || !requirements || !Array.isArray(requirements)) {
      return res.status(400).json({ error: "Missing template ID or requirements" });
    }

    console.log("Starting contract generation with:", { templateId, requirements });

    const contractText = await generateContract(
      templateId,
      requirements,
      customInstructions
    );

    console.log("Contract generated successfully");

    const template = getTemplate(templateId);
    const title = template ? `${template.name} - Generated` : 'Generated Contract';

    const [document] = await db
      .insert(documents)
      .values({
        title,
        content: contractText,
        userId: req.user?.id,
        processingStatus: "COMPLETED",
        agentType: "CONTRACT_AUTOMATION"
      })
      .returning();

    console.log("Contract saved with ID:", document.id);

    return res.json({
      id: document.id,
      title,
      content: contractText
    });

  } catch (error: any) {
    console.error("Contract generation error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate contract" });
  }
});

// Upload and analyze document
router.post("/api/documents", upload.single('file'), async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("Processing uploaded file:", req.file.originalname);

    // Convert file buffer to text
    const content = req.file.buffer.toString('utf-8');
    const title = req.file.originalname;

    // Analyze the document
    console.log("Starting document analysis...");
    const analysis = await analyzeDocument(content);

    console.log("Document analysis completed, saving to database...");

    // Save document with analysis
    const [document] = await db
      .insert(documents)
      .values({
        title,
        content,
        userId: req.user!.id,
        processingStatus: "COMPLETED",
        agentType: "DOCUMENT_UPLOAD",
        analysis: JSON.stringify(analysis)
      })
      .returning();

    console.log("Document saved to database with ID:", document.id);

    return res.json({
      id: document.id,
      title,
      analysis
    });

  } catch (error: any) {
    console.error("Document upload/analysis error:", error);

    if (error instanceof multer.MulterError) {
      return res.status(400).json({ 
        error: "File upload error",
        details: error.message 
      });
    }

    return res.status(500).json({ 
      error: error.message || "Failed to process document",
      details: error.stack
    });
  }
});

export default router;