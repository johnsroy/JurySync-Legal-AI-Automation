import { Router } from "express";
import { AIOrchestrator } from "../services/ai-orchestrator";
import multer from "multer";
import debug from "debug";
import { db } from "../db";
import { documents } from "@shared/schema";
import { eq } from "drizzle-orm";
import { documentProcessor } from "../services/documentProcessor";

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
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: PDF, DOC, DOCX, TXT`));
    }
  },
}).single("document");

// Initialize AI Orchestrator singleton
const aiOrchestrator = new AIOrchestrator();

// Document processing endpoint
router.post("/process", async (req, res) => {
  try {
    // Step 1: Handle file upload
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

    log("File received:", {
      filename: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype
    });

    // Step 2: Process document content
    const processResult = await documentProcessor.processDocument(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    if (!processResult.success || !processResult.content) {
      log("Document processing failed:", processResult.error);
      return res.status(400).json({
        success: false,
        error: processResult.error || "Failed to process document content"
      });
    }

    log("Document processed successfully:", {
      contentLength: processResult.content.length,
      metadata: processResult.metadata
    });

    // Step 3: Create initial document record
    const [document] = await db.insert(documents)
      .values({
        title: req.file.originalname,
        content: processResult.content,
        status: "processing",
        metadata: {
          ...processResult.metadata,
          originalFilename: req.file.originalname,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          uploadedAt: new Date().toISOString()
        },
        processingStatus: "PROCESSING",
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    log("Document record created:", { id: document.id });

    // Step 4: Process document through AI orchestrator
    try {
      const result = await aiOrchestrator.processDocument(
        processResult.content,
        "upload"
      );

      if (!result?.success) {
        throw new Error(result?.error || "AI processing failed");
      }

      log("AI processing completed:", {
        documentId: document.id,
        resultKeys: Object.keys(result.result)
      });

      // Update document with processing results
      await db.update(documents)
        .set({
          processingStatus: "COMPLETED",
          analysis: result.result,
          updatedAt: new Date()
        })
        .where(eq(documents.id, document.id));

      return res.json({
        success: true,
        documentId: document.id,
        result: result.result,
      });

    } catch (error) {
      log("AI processing error:", error);

      // Update document with error status
      await db.update(documents)
        .set({
          processingStatus: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Processing failed",
          updatedAt: new Date()
        })
        .where(eq(documents.id, document.id));

      return res.status(500).json({
        success: false,
        error: "Failed to process document"
      });
    }
  } catch (error) {
    log("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to process document"
    });
  }
});

// Status check endpoint
router.get("/status/:documentId", async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);

    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

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
      error: "Failed to check document status"
    });
  }
});

export default router;