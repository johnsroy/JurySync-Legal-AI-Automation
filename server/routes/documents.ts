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
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['text/plain', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'));
    }
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
      return res.status(400).json({
        error: "Missing required fields",
        details: "Template type and requirements array are required"
      });
    }

    // Generate contract
    const content = await generateContract(templateType, requirements, customInstructions);

    // Save to database
    const [document] = await db
      .insert(documents)
      .values({
        title: `${templateType} Contract`,
        content,
        userId: req.user!.id,
        processingStatus: "COMPLETED",
        agentType: "CONTRACT_AUTOMATION"
      })
      .returning();

    res.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        content
      }
    });

  } catch (error: any) {
    console.error("Generation error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate contract"
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
        success: false,
        error: "No file uploaded"
      });
    }

    const content = req.file.buffer.toString('utf-8');
    const title = req.file.originalname;

    // Save to database
    const [document] = await db
      .insert(documents)
      .values({
        title,
        content,
        userId: req.user!.id,
        processingStatus: "COMPLETED",
        agentType: "DOCUMENT_UPLOAD"
      })
      .returning();

    res.json({
      success: true,
      document: {
        id: document.id,
        title: document.title
      }
    });

  } catch (error: any) {
    console.error("Upload error:", error);

    // Handle multer errors specifically
    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        error: "File upload error",
        details: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Failed to upload document"
    });
  }
});

export default router;