import { Router } from "express";
import { AIOrchestrator } from "../services/ai-orchestrator";
import multer from "multer";
import debug from "debug";
import { db } from "../db";
import { documents } from "@shared/schema";
import { eq } from "drizzle-orm";

const log = debug("app:workflow-automation");
const router = Router();

// Configure multer
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

// Debug: Log AI Orchestrator initialization
let aiOrchestrator: AIOrchestrator | null = null;
try {
  log("Initializing AI Orchestrator...");
  aiOrchestrator = new AIOrchestrator();
  log("AI Orchestrator initialized successfully");
} catch (error) {
  log("Failed to initialize AI Orchestrator:", error);
}

// Document processing endpoint
router.post("/process", async (req, res) => {
  try {
    // Debug: Verify AI Orchestrator
    if (!aiOrchestrator) {
      log("AI Orchestrator not available, reinitializing...");
      try {
        aiOrchestrator = new AIOrchestrator();
      } catch (initError) {
        log("Failed to reinitialize AI Orchestrator:", initError);
        return res.status(500).json({
          success: false,
          error: "AI service unavailable",
        });
      }
    }

    // Handle file upload
    await new Promise((resolve, reject) => {
      upload(req, res, (err) => {
        if (err) {
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

    // Debug: Extract and verify content
    const content = req.file.buffer.toString('utf-8');
    log("Content extracted, length:", content.length);

    // Store document with minimal fields first
    let document;
    try {
      const [doc] = await db.insert(documents)
        .values({
          title: req.file.originalname,
          content: content,
          userId: (req.user as any)?.id || 1,
          documentType: "CONTRACT",
          processingStatus: "PROCESSING",
          createdAt: new Date(),
        })
        .returning();
      document = doc;
      log("Document stored:", document.id);
    } catch (dbError) {
      log("Database error:", dbError);
      return res.status(500).json({
        success: false,
        error: "Database error",
      });
    }

    // Process with AI
    try {
      log("Starting AI processing for document:", document.id);
      const result = await aiOrchestrator.processDocument(content, "upload");

      log("AI processing result:", {
        success: result?.success,
        hasResult: !!result?.result,
      });

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

    } catch (aiError) {
      log("AI processing error:", aiError);

      // Update document status
      await db.update(documents)
        .set({
          processingStatus: "FAILED",
          errorMessage: aiError instanceof Error ? aiError.message : "AI processing failed",
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