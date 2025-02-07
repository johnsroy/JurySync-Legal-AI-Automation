import { Router } from "express";
import multer from "multer";
import { generateContract, analyzeDocument } from "../services/openai";
import { getAllTemplates } from "../services/templateStore";
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

// Get available templates
router.get("/api/templates", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const templates = getAllTemplates();
    return res.json(templates);

  } catch (error: any) {
    console.error("Template fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// Generate contract
router.post("/api/documents/generate", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { templateType, requirements, customInstructions } = req.body;

    if (!templateType || !requirements || !Array.isArray(requirements)) {
      return res.status(400).json({ error: "Missing template type or requirements" });
    }

    console.log("Starting contract generation with:", { templateType, requirements });

    // Generate contract text using template
    const contractText = await generateContract(
      templateType,
      requirements,
      customInstructions
    );

    console.log("Contract generated successfully");

    // Save to database
    const [document] = await db
      .insert(documents)
      .values({
        title: `${templateType} Contract`,
        content: contractText,
        userId: req.user!.id,
        processingStatus: "COMPLETED",
        agentType: "CONTRACT_AUTOMATION"
      })
      .returning();

    console.log("Contract saved with ID:", document.id);

    return res.status(200).json({
      id: document.id,
      content: contractText,
      title: `${templateType} Contract` // Added title to response for clarity
    });

  } catch (error: any) {
    console.error("Contract generation error:", error);
    return res.status(500).json({ 
      error: error.message || "Failed to generate contract"
    });
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