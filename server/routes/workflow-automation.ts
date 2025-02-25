import { Router } from "express";
import { AIOrchestrator } from "../services/ai-orchestrator";
import multer from "multer";
import debug from "debug";
import { db } from "../db";
import { documents } from "@shared/schema";
import { eq } from "drizzle-orm";

const log = debug("app:workflow-automation");
const router = Router();

// Configure multer for file uploads
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
      cb(null, false);
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: PDF, DOC, DOCX, TXT`));
    }
  },
}).single("document");

// Initialize AI Orchestrator
let aiOrchestrator: AIOrchestrator | null = null;

// Document processing endpoint
router.post("/process", async (req, res) => {
  try {
    // Step 1: File Upload
    await new Promise<void>((resolve, reject) => {
      upload(req, res, (err) => {
        if (err) {
          log("Upload error:", err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    if (!req.file) {
      log("No file received");
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    // Step 2: Initialize AI Orchestrator if needed
    if (!aiOrchestrator) {
      try {
        log("Initializing AI Orchestrator");
        aiOrchestrator = new AIOrchestrator();
      } catch (error) {
        log("AI Orchestrator initialization failed:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to initialize AI service",
        });
      }
    }

    // Step 3: Create initial document record
    let document;
    try {
      const [doc] = await db.insert(documents)
        .values({
          title: req.file.originalname,
          content: req.file.buffer.toString('utf-8'),
          userId: (req.user as any)?.id || 1,
          documentType: "CONTRACT",
          processingStatus: "PROCESSING",
          createdAt: new Date(),
        })
        .returning();
      document = doc;
      log("Document created:", { id: document.id });
    } catch (error) {
      log("Database error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create document record",
      });
    }

    // Step 4: Process document
    try {
      const result = await aiOrchestrator.processDocument(
        req.file.buffer.toString('utf-8'),
        "upload"
      );

      if (!result?.success) {
        throw new Error("AI processing failed");
      }

      // Update document with results
      await db.update(documents)
        .set({
          processingStatus: "COMPLETED",
          analysis: result.result,
        })
        .where(eq(documents.id, document.id));

      return res.json({
        success: true,
        documentId: document.id,
        result: result.result,
      });

    } catch (error) {
      log("Processing error:", error);

      // Update document status
      await db.update(documents)
        .set({
          processingStatus: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Processing failed",
        })
        .where(eq(documents.id, document.id));

      return res.status(500).json({
        success: false,
        error: "Failed to process document",
      });
    }
  } catch (error) {
    log("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to process document",
    });
  }
});

// Status check endpoint
router.get("/status/:documentId", async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);

    const document = await db.query.documents.findFirst({
      where: (documents, { eq }) => eq(documents.id, documentId),
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
      error: document.errorMessage,
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