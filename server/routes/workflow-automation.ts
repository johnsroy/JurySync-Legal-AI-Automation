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

// Initialize AI Orchestrator with error handling
let aiOrchestrator: AIOrchestrator;
try {
  aiOrchestrator = new AIOrchestrator();
  log("AI Orchestrator initialized successfully");
} catch (error) {
  log("Error initializing AI Orchestrator:", error);
  aiOrchestrator = new AIOrchestrator(); // Retry initialization
}

// Document processing endpoint
router.post("/process", async (req, res) => {
  try {
    // Handle file upload with detailed error logging
    await new Promise((resolve, reject) => {
      upload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          log("Multer error:", err);
          reject(new Error(`File upload error: ${err.message}`));
        } else if (err) {
          log("Upload error:", err);
          reject(err);
        } else {
          resolve(true);
        }
      });
    });

    if (!req.file) {
      log("No file uploaded");
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    log("File received:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    // Store initial document record
    let document;
    try {
      log("Storing initial document record");
      const [doc] = await db.insert(documents).values({
        title: req.file.originalname,
        content: req.file.buffer.toString('utf-8'),
        userId: (req.user as any)?.id || 1,
        documentType: "CONTRACT",
        processingStatus: "PROCESSING",
        createdAt: new Date(),
      }).returning();
      document = doc;
      log("Document stored successfully", { documentId: document.id });
    } catch (dbError) {
      log("Database error:", dbError);
      return res.status(500).json({
        success: false,
        error: "Failed to store document in database"
      });
    }

    // Process document through AI orchestrator with detailed error handling
    try {
      if (!aiOrchestrator) {
        throw new Error("AI Orchestrator not initialized");
      }

      log("Starting AI processing for document:", document.id);
      const result = await aiOrchestrator.processDocument(
        req.file.buffer.toString('utf-8'),
        "upload"
      );

      if (!result || !result.success) {
        throw new Error(result?.error || "AI processing failed without error details");
      }

      log("AI processing completed successfully", {
        documentId: document.id,
        resultKeys: Object.keys(result.result || {})
      });

      // Update document with processing results
      await db.update(documents)
        .set({
          analysis: result.result,
          processingStatus: "COMPLETED",
        })
        .where(eq(documents.id, document.id));

      return res.json({
        success: true,
        documentId: document.id,
        result: result.result,
      });
    } catch (aiError) {
      log("AI processing error:", aiError);

      // Update document with error status
      await db.update(documents)
        .set({
          processingStatus: "FAILED",
          errorMessage: aiError instanceof Error ? aiError.message : "Processing failed"
        })
        .where(eq(documents.id, document.id));

      return res.status(500).json({
        success: false,
        error: "Failed to process document",
        details: aiError instanceof Error ? aiError.message : undefined
      });
    }
  } catch (error) {
    log("Unexpected error in document processing:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to process document",
      details: error instanceof Error ? error.message : undefined
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