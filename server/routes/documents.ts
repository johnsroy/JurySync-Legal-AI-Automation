import { Router } from "express";
import { generateContract, suggestRequirements, getAutocomplete } from "../services/openai";
import { getAllTemplates, getTemplate } from "../services/templateStore";
import { db } from "../db";
import { documents } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { Document, Packer, Paragraph, TextRun } from "docx";
import PDFDocument from "pdfkit";
import { eq } from 'drizzle-orm';

const router = Router();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Get all available templates
router.get("/api/templates", async (_req, res) => {
  try {
    console.log("[Templates] Fetching all templates");

    const templates = getAllTemplates();
    console.log(`[Templates] Found ${templates.length} templates`);

    if (!templates || templates.length === 0) {
      console.log("[Templates] No templates available");
      return res.status(404).json({ 
        error: "No templates available",
        code: "NO_TEMPLATES"
      });
    }

    templates.forEach(template => {
      console.log(`[Templates] Returning template: ${template.id} - ${template.name}`);
    });

    return res.json(templates);
  } catch (error: any) {
    console.error("[Templates] Error fetching templates:", error);
    return res.status(500).json({ 
      error: "Failed to fetch templates",
      code: "TEMPLATE_FETCH_ERROR",
      details: error.message 
    });
  }
});

// Get specific template details
router.get("/api/templates/:id", async (req, res) => {
  try {
    console.log(`[Templates] Fetching template: ${req.params.id}`);

    const template = getTemplate(req.params.id);
    if (!template) {
      console.log(`[Templates] Template not found: ${req.params.id}`);
      return res.status(404).json({ 
        error: "Template not found",
        code: "TEMPLATE_NOT_FOUND"
      });
    }

    console.log(`[Templates] Successfully retrieved template: ${template.name}`);
    return res.json(template);
  } catch (error: any) {
    console.error("[Templates] Template fetch error:", error);
    return res.status(500).json({ 
      error: "Failed to fetch template",
      code: "TEMPLATE_FETCH_ERROR",
      details: error.message 
    });
  }
});

// Generate contract from template
router.post("/api/documents/generate", async (req, res) => {
  try {
    const { templateId, requirements, customInstructions } = req.body;

    if (!templateId || !requirements || !Array.isArray(requirements)) {
      return res.status(400).json({ 
        error: "Missing template ID or requirements",
        code: "INVALID_INPUT" 
      });
    }

    console.log("[Contract Generation] Starting with:", { templateId, requirementsCount: requirements.length });

    const contractText = await generateContract(
      templateId,
      requirements,
      customInstructions
    );

    console.log("[Contract Generation] Contract generated successfully");

    const template = getTemplate(templateId);
    const title = template ? `${template.name} - Generated` : 'Generated Contract';

    const [document] = await db
      .insert(documents)
      .values({
        title,
        content: contractText,
        userId: req.user?.id || 1, // Temporary fallback for testing
        processingStatus: "COMPLETED",
        agentType: "CONTRACT_AUTOMATION",
        analysis: JSON.stringify({
          contractDetails: {
            generatedAt: new Date().toISOString(),
            template: templateId,
            requirements
          }
        })
      })
      .returning();

    console.log("[Contract Generation] Saved with ID:", document.id);

    return res.json({
      id: document.id,
      title,
      content: contractText
    });

  } catch (error: any) {
    console.error("[Contract Generation] Error:", error);
    return res.status(500).json({ 
      error: error.message || "Failed to generate contract",
      code: "GENERATION_ERROR"
    });
  }
});

// Upload and analyze document
router.post("/api/documents", upload.single('file'), async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("Processing uploaded file:", req.file.originalname);

    // Convert file buffer to text
    const content = req.file.buffer.toString('utf-8');
    const title = req.file.originalname;

    // Analyze the document
    console.log("Starting document analysis...");
    const analysis = await analyzeDocument(content);

    console.log("Document analysis completed, saving to database...");

    // Save document with analysis
    const [document] = await db
      .insert(documents)
      .values({
        title,
        content,
        userId: req.user!.id,
        processingStatus: "COMPLETED",
        agentType: "DOCUMENT_UPLOAD",
        analysis: JSON.stringify(analysis)
      })
      .returning();

    console.log("Document saved to database with ID:", document.id);

    return res.json({
      id: document.id,
      title,
      analysis
    });

  } catch (error: any) {
    console.error("Document upload/analysis error:", error);

    if (error instanceof multer.MulterError) {
      return res.status(400).json({ 
        error: "File upload error",
        details: error.message 
      });
    }

    return res.status(500).json({ 
      error: error.message || "Failed to process document",
      details: error.stack
    });
  }
});

// Download document as DOCX
router.get("/api/documents/:id/download/docx", async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const docx = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun(doc.content)
            ],
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(docx);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=${doc.title.replace(/\s+/g, '_')}.docx`);
    res.send(buffer);

  } catch (error) {
    console.error("Error generating DOCX:", error);
    res.status(500).json({ error: "Failed to generate DOCX file" });
  }
});

// Download document as PDF
router.get("/api/documents/:id/download/pdf", async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const pdfDoc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${doc.title.replace(/\s+/g, '_')}.pdf`);

    pdfDoc.pipe(res);
    pdfDoc.fontSize(12).text(doc.content);
    pdfDoc.end();

  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF file" });
  }
});

// Get requirement suggestions
router.post("/api/templates/:id/suggest-requirements", async (req, res) => {
  try {
    const templateId = req.params.id;
    const { currentDescription } = req.body;

    console.log(`[Templates] Generating suggestions for template: ${templateId}`);

    const suggestions = await suggestRequirements(templateId, currentDescription);

    console.log(`[Templates] Generated ${suggestions.length} suggestions`);

    return res.json(suggestions);
  } catch (error: any) {
    console.error("[Templates] Suggestion error:", error);
    return res.status(500).json({ 
      error: "Failed to generate suggestions",
      code: "SUGGESTION_ERROR",
      details: error.message 
    });
  }
});

// Get autocomplete suggestions
router.get("/api/templates/:id/autocomplete", async (req, res) => {
  try {
    const templateId = req.params.id;
    const partialText = req.query.text as string;

    if (!partialText) {
      return res.status(400).json({
        error: "Missing partial text",
        code: "INVALID_INPUT"
      });
    }

    console.log(`[Templates] Getting autocomplete for: ${partialText}`);

    const suggestions = await getAutocomplete(templateId, partialText);

    console.log(`[Templates] Generated ${suggestions.suggestions.length} autocomplete suggestions`);

    return res.json(suggestions);
  } catch (error: any) {
    console.error("[Templates] Autocomplete error:", error);
    return res.status(500).json({ 
      error: "Failed to get autocomplete suggestions",
      code: "AUTOCOMPLETE_ERROR",
      details: error.message 
    });
  }
});

export default router;