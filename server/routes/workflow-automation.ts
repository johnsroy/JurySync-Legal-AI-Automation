import { Router } from "express";
import { AIOrchestrator } from "../services/ai-orchestrator";
import multer from "multer";
import debug from "debug";
import { db } from "../db";
import { documents } from "@shared/schema";
import { eq } from "drizzle-orm";

const log = debug("app:workflow-automation");
const router = Router();

// Configure multer with memory storage and file type validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: PDF, DOC, DOCX, TXT`));
    }
  },
}).single("document");

const aiOrchestrator = new AIOrchestrator();

// Document processing endpoint
router.post("/process", async (req, res) => {
  try {
    // Handle file upload
    await new Promise((resolve, reject) => {
      upload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          reject(new Error(`File upload error: ${err.message}`));
        } else if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    log("Processing file:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    // Extract text content based on file type
    let content = req.file.buffer.toString('utf-8');

    // Store initial document record
    const [document] = await db.insert(documents).values({
      title: req.file.originalname,
      content: content,
      userId: (req.user as any)?.id || 1,
      agentType: "workflow_automation",
      processingStatus: "processing",
      createdAt: new Date(),
    }).returning();

    // Process document through AI orchestrator
    try {
      const result = await aiOrchestrator.processDocument(content, "upload");

      // Update document with processing results
      await db.update(documents)
        .set({
          analysis: result.result,
          processingStatus: "completed",
        })
        .where(eq(documents.id, document.id));

      return res.json({
        success: true,
        documentId: document.id,
        result: result.result,
      });
    } catch (error) {
      // Update document with error status
      await db.update(documents)
        .set({
          processingStatus: "failed",
          errorMessage: error instanceof Error ? error.message : "Processing failed",
        })
        .where(eq(documents.id, document.id));

      throw error;
    }
  } catch (error) {
    log("Processing error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to process document",
    });
  }
});

// Status check endpoint
router.get("/status/:documentId", async (req, res) => {
  try {
    const document = await db.query.documents.findFirst({
      where: (documents, { eq }) => eq(documents.id, parseInt(req.params.documentId)),
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found",
      });
    }

    return res.json({
      success: true,
      status: document.processingStatus,
      analysis: document.analysis,
      errorMessage: document.errorMessage,
    });
  } catch (error) {
    log("Status check error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to check document status",
    });
  }
});

export default router;