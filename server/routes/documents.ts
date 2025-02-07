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
    fileSize: 5 * 1024 * 1024, // 5MB limit
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
        error: "Missing required fields",
        details: "Template type and requirements array are required"
      });
    }

    // Generate contract
    const { content } = await generateContract(templateType, requirements, customInstructions);

    // Save to database
    const [document] = await db
      .insert(documents)
      .values({
        userId: req.user!.id,
        content,
        processingStatus: "COMPLETED",
        agentType: "CONTRACT_AUTOMATION"
      })
      .returning();

    return res.json({
      success: true,
      data: {
        id: document.id,
        content
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

// Upload document
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

    // Save to database
    const [document] = await db
      .insert(documents)
      .values({
        userId: req.user!.id,
        content,
        processingStatus: "COMPLETED",
        agentType: "DOCUMENT_UPLOAD"
      })
      .returning();

    return res.json({
      success: true,
      data: {
        id: document.id,
        content
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
      error: error.message || "Failed to upload document"
    });
  }
});

export default router;