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

    log("Processing file:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    // Extract text content based on file type
    let content;
    try {
      log("Extracting content from file");
      content = req.file.buffer.toString('utf-8');

      if (!content || content.trim().length === 0) {
        throw new Error("No content could be extracted from file");
      }

      log("Content extracted successfully", {
        contentLength: content.length,
        preview: content.substring(0, 100) + "..."
      });
    } catch (error) {
      log("Content extraction error:", error);
      return res.status(400).json({
        success: false,
        error: "Failed to extract content from file"
      });
    }

    // Store initial document record
    let document;
    try {
      log("Storing initial document record");
      const [doc] = await db.insert(documents).values({
        name: req.file.originalname,
        content: content,
        userId: (req.user as any)?.id || 1,
        mimeType: req.file.mimetype,
        status: "processing",
        createdAt: new Date(),
      }).returning();
      document = doc;
      log("Document stored successfully", { documentId: document.id });
    } catch (error) {
      log("Database error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to store document"
      });
    }

    // Process document through AI orchestrator
    try {
      log("Starting AI processing");
      const result = await aiOrchestrator.processDocument(content, "upload");
      log("AI processing completed successfully", { result });

      // Update document with processing results
      await db.update(documents)
        .set({
          analysis: result.result,
          status: "completed",
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
          status: "failed",
          error: error instanceof Error ? error.message : "Processing failed",
        })
        .where(eq(documents.id, document.id));

      return res.status(500).json({
        success: false,
        error: "Failed to process document",
        details: error instanceof Error ? error.message : undefined
      });
    }
  } catch (error) {
    log("Unexpected error:", error);
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
      status: document.status,
      analysis: document.analysis,
      error: document.error,
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