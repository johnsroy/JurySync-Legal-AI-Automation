import { Router } from "express";
import { db } from "../db";
import { contractTemplates, documents } from "@shared/schema";
import { eq } from "drizzle-orm";
import { anthropic } from "../anthropic";
import OpenAI from "openai";
import {
  generateContract,
  generateTemplatePreview,
  generateSmartSuggestions,
} from "../services/contract-automation-service";
import { pdfService } from "../services/pdf-service";
import * as docx from "docx";
import multer from "multer";
import { DocumentProcessor } from "../services/document-processor";

const router = Router();
const openai = new OpenAI();
const documentProcessor = new DocumentProcessor();

// Configure multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
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
});

// Document processing endpoint
router.post("/process", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    let content: string;
    let metadata: Record<string, any> = {};

    // Process different file types
    if (req.file.mimetype === "application/pdf") {
      try {
        const parseResult = await pdfService.parseDocument(req.file.buffer);
        content = parseResult.text;
        metadata = {
          ...parseResult.metadata,
          pageCount: parseResult.metadata.pageCount,
          isScanned: parseResult.metadata.isScanned,
        };
      } catch (error) {
        console.error("PDF parsing error:", error);
        throw new Error("Failed to parse PDF document");
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

    // Store the processed document
    const [document] = await db
      .insert(documents)
      .values({
        name: req.file.originalname,
        content: content,
        mimeType: req.file.mimetype,
        metadata: metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return res.json({
      success: true,
      documentId: document.id,
      content: content.substring(0, 1000), // Send preview only
      metadata,
    });
  } catch (error) {
    console.error("Document processing error:", error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to process document",
    });
  }
});

// Get all templates with search and filtering
router.get("/templates", async (req, res) => {
  try {
    const { search, category } = req.query;
    let templates = await db.select().from(contractTemplates);

    // Filter by search if provided
    if (search && typeof search === "string") {
      const searchLower = search.toLowerCase();
      templates = templates.filter(
        (template) =>
          template.name.toLowerCase().includes(searchLower) ||
          template.description.toLowerCase().includes(searchLower),
      );
    }

    // Filter by category if provided
    if (category && typeof category === "string") {
      templates = templates.filter(
        (template) => template.category === category,
      );
    }

    // Format response for frontend
    const groupedTemplates = templates.reduce(
      (acc, template) => {
        if (!acc[template.category]) {
          acc[template.category] = [];
        }
        acc[template.category].push(template);
        return acc;
      },
      {} as Record<string, any[]>,
    );

    return res.json({
      success: true,
      templates: groupedTemplates,
    });
  } catch (error) {
    console.error("Failed to fetch templates:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch templates",
    });
  }
});

// Update the suggestions endpoint
router.get("/suggestions", async (req, res) => {
  try {
    const { q: selectedText, content } = req.query;
    if (!selectedText || typeof selectedText !== "string") {
      return res.status(400).json({
        success: false,
        error: "Selected text is required",
      });
    }

    const suggestions = await generateSmartSuggestions(
      selectedText,
      content as string,
    );

    return res.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error("Failed to get suggestions:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get suggestions",
    });
  }
});

// Download endpoint with improved handling
router.post("/export", async (req, res) => {
  const { content, format } = req.body;

  if (!content) {
    return res.status(400).json({
      success: false,
      error: "Content is required",
    });
  }

  if (format === "pdf") {
    try {
      const pdfDoc = await pdfService.generatePDF(content, {
        title: "Contract Document",
        author: "Contract Automation System",
        subject: "Generated Contract",
        keywords: ["contract", "legal", "document"],
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=contract.pdf");
      pdfDoc.pipe(res);
      pdfDoc.end();
    } catch (error) {
      console.error("PDF generation error:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  } else if (format === "docx") {
    const doc = new docx.Document({
      sections: [
        {
          properties: {},
          children: [
            new docx.Paragraph({
              children: [
                new docx.TextRun({
                  text: content,
                  font: "Times New Roman",
                  size: 24, // 12pt
                }),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await docx.Packer.toBuffer(doc);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader("Content-Disposition", "attachment; filename=contract.docx");
    return res.send(buffer);
  }

  return res.status(400).json({
    success: false,
    error: "Invalid format specified",
  });
});

// Template upload endpoint
router.post("/templates/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    let content: string;
    let metadata: Record<string, any> = {};

    if (req.file.mimetype === "application/pdf") {
      const parseResult = await pdfService.parseDocument(req.file.buffer);
      content = parseResult.text;
      metadata = parseResult.metadata;
    } else if (
      req.file.mimetype.includes("word") ||
      req.file.mimetype === "text/plain"
    ) {
      content = await documentProcessor.extractText(
        req.file.buffer,
        req.file.mimetype,
      );
    } else {
      throw new Error("Unsupported file type");
    }

    const [template] = await db
      .insert(contractTemplates)
      .values({
        name: req.file.originalname,
        content: content,
        category: req.body.category || "General",
        metadata: metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return res.json({
      success: true,
      templateId: template.id,
      content: content.substring(0, 1000), // Send preview only
      metadata,
    });
  } catch (error) {
    console.error("Template upload error:", error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to process template",
    });
  }
});

export default router;
