import { Router } from "express";
import multer from "multer";
import { generateContract, analyzeDocument } from "../services/openai";
import { getAllTemplates } from "../services/templateStore";
import { db } from "../db";
import { documents } from "@shared/schema";

const router = Router();

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
      return res.status(401).json({
        success: false,
        error: "Not authenticated"
      });
    }

    const templates = getAllTemplates();
    return res.json({
      success: true,
      data: templates
    });

  } catch (error: any) {
    console.error("Template fetch error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch templates"
    });
  }
});

// Generate contract
router.post("/api/documents/generate", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated"
      });
    }

    const { templateType, requirements, customInstructions } = req.body;

    if (!templateType || !requirements || !Array.isArray(requirements)) {
      return res.status(400).json({
        success: false,
        error: "Missing template type or requirements"
      });
    }

    // Generate contract text using template
    const contractText = await generateContract(
      templateType,
      requirements,
      customInstructions
    );

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

    return res.json({
      success: true,
      data: {
        id: document.id,
        content: contractText
      }
    });

  } catch (error: any) {
    console.error("Generation error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate contract"
    });
  }
});

// Upload and analyze document
router.post("/api/documents", upload.single('file'), async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded"
      });
    }

    const content = req.file.buffer.toString('utf-8');
    const title = req.file.originalname;

    // Analyze the document
    const analysis = await analyzeDocument(content);

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

    return res.json({
      success: true,
      data: {
        id: document.id,
        title,
        analysis
      }
    });

  } catch (error: any) {
    console.error("Upload error:", error);

    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        error: "File upload error",
        details: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to upload and analyze document"
    });
  }
});

export default router;