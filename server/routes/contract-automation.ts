import { Router } from "express";
import { db } from "../db";
import { contractTemplates } from "@shared/schema";
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

const router = Router();
const openai = new OpenAI();

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

// Update the template upload endpoint to use pdfService for PDF parsing
router.post("/templates/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (req.file.mimetype === "application/pdf") {
      const parseResult = await pdfService.parseDocument(req.file.buffer);
      // ... rest of the template processing logic ...
    }
    // ... handle other file types ...
  } catch (error) {
    console.error("Template upload error:", error);
    res.status(500).json({ error: "Failed to process template" });
  }
});

export default router;
