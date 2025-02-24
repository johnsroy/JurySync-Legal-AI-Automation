import { Router } from "express";
import { AIOrchestrator } from "../services/ai-orchestrator";
import multer from "multer";
import { z } from "zod";
import { PDFParser } from "../services/pdf-parser";
import { DocumentProcessor } from "../services/document-processor";
import { createHash } from "crypto";
import debug from "debug";
import { db } from "../db";
import { documents } from "@shared/schema";

const log = debug("app:workflow-automation");

const router = Router();

// Configure multer with more detailed error handling
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
      cb(
        new Error(
          `Invalid file type: ${file.mimetype}. Allowed types: PDF, DOC, DOCX, TXT`,
        ),
      );
    }
  },
}).single("document");

const aiOrchestrator = new AIOrchestrator();
const pdfParser = new PDFParser();
const documentProcessor = new DocumentProcessor();

// Helper function to generate document hash
const generateDocumentHash = (buffer: Buffer): string => {
  return createHash("sha256").update(buffer).digest("hex");
};

// Document processing endpoint with enhanced error handling and processing
router.post("/process", async (req, res) => {
  try {
    // Wrap multer upload in a promise
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

    // Generate document hash for deduplication
    const documentHash = generateDocumentHash(req.file.buffer);

    // Check for existing processed document
    const existingDoc = await db.query.documents.findFirst({
      where: (documents, { eq }) => eq(documents.hash, documentHash),
    });

    if (existingDoc) {
      log("Found existing processed document");
      return res.json({
        success: true,
        result: existingDoc.processedContent,
        cached: true,
      });
    }

    let content: string;
    let metadata: Record<string, any> = {};

    // Process different file types
    if (req.file.mimetype === "application/pdf") {
      try {
        const parseResult = await pdfParser.parse(req.file.buffer);
        content = parseResult.text;
        metadata = {
          ...parseResult.metadata,
          pageCount: parseResult.pageCount,
          isScanned: parseResult.isScanned,
        };

        // Handle scanned PDFs
        if (parseResult.isScanned) {
          log("Processing scanned PDF with OCR");
          const ocrResult = await pdfParser.processWithOCR(req.file.buffer);
          content = ocrResult.text;
          metadata.ocrConfidence = ocrResult.confidence;
        }
      } catch (error) {
        log("PDF parsing error:", error);
        throw new Error(
          "Failed to parse PDF document. Please ensure the file is not corrupted.",
        );
      }
    } else {
      // Handle other document types
      content = await documentProcessor.extractText(
        req.file.buffer,
        req.file.mimetype,
      );
    }

    if (!content || content.trim().length === 0) {
      throw new Error("No text content could be extracted from the document");
    }

    // Process document through orchestrator
    const result = await aiOrchestrator.processDocument(content, "upload", {
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      metadata,
    });

    // Store processed document
    await db.insert(documents).values({
      hash: documentHash,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      processedContent: result,
      metadata: metadata,
    });

    return res.json({
      success: true,
      result,
      metadata,
    });
  } catch (error) {
    log("Processing error:", error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to process document",
      details: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
});

// Status check endpoint
router.get("/status/:documentId", async (req, res) => {
  try {
    const document = await db.query.documents.findFirst({
      where: (documents, { eq }) => eq(documents.id, req.params.documentId),
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
      progress: document.progress,
      result: document.processedContent,
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
