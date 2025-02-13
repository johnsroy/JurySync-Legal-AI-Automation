import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { documents } from "@shared/schema";
import { eq } from 'drizzle-orm';
import { analyzePDFContent } from "../services/fileAnalyzer";
import mammoth from 'mammoth';
import PDFDocument from "pdfkit";
import { approvalAuditService } from "../services/approvalAuditService";
import { analyzeDocument } from "../services/documentAnalysisService";
import { 
  getAllTemplates, 
  getTemplate, 
  getTemplatesByCategory,
  suggestRequirements,
  getAutocomplete,
  getCustomInstructionSuggestions,
  generateContract 
} from "../services/templateStore";

const router = Router();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF and Word documents are supported.`));
    }
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
        userId: req.user?.id || 1,
        processingStatus: "COMPLETED",
        agentType: "CONTRACT_AUTOMATION",
        analysis: {
          documentType: "Contract",
          industry: template?.industry || "Unknown",
          classification: "Generated Contract",
          source: "contract-automation",
          contractDetails: {
            generatedAt: new Date().toISOString(),
            template: templateId,
            requirements
          }
        }
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

// Update the document upload endpoint
router.post("/api/workflow/upload", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("Processing document upload:", {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    let content = '';

    // Extract content based on file type
    try {
      if (req.file.mimetype.includes('pdf')) {
        content = await analyzePDFContent(req.file.buffer, -1);
      } else if (req.file.mimetype.includes('word')) {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        content = result.value;
      } else if (req.file.mimetype.includes('plain')) {
        content = req.file.buffer.toString('utf8');
      }

      if (!content || !content.trim()) {
        throw new Error('Failed to extract content from document');
      }

      // Clean content
      content = content
        .replace(/\u0000/g, '')
        .replace(/[\uFFFD\uFFFE\uFFFF]/g, '')
        .replace(/[\u0000-\u001F]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/<!DOCTYPE[^>]*>/g, '')
        .replace(/<\/?[^>]+(>|$)/g, '')
        .trim();

      console.log("Content extracted and cleaned, length:", content.length);

      // Analyze document using our enhanced service
      const analysis = await analyzeDocument(content);

      console.log("Document analysis results:", {
        documentType: analysis.documentType,
        industry: analysis.industry,
        complianceStatus: analysis.complianceStatus
      });

      // Create document record in database
      const [document] = await db.insert(documents).values({
        userId: req.user?.id || 1,
        title: req.file.originalname,
        content: content,
        processingStatus: "COMPLETED",
        agentType: "LEGAL_RESEARCH",
        analysis: {
          documentType: analysis.documentType,
          industry: analysis.industry,
          classification: analysis.classification,
          keywords: analysis.keywords,
          entities: analysis.entities,
          confidence: analysis.confidence,
          riskLevel: analysis.riskLevel,
          recommendations: analysis.recommendations,
          source: "workflow-automation",
          complianceStatus: analysis.complianceStatus
        }
      }).returning();

      console.log("Document uploaded successfully:", {
        id: document.id,
        title: document.title,
        contentLength: content.length,
        documentType: analysis.documentType,
        industry: analysis.industry
      });

      return res.json({
        documentId: document.id,
        title: document.title,
        text: content,
        analysis: {
          documentType: analysis.documentType,
          industry: analysis.industry,
          classification: analysis.classification,
          complianceStatus: analysis.complianceStatus
        },
        status: "COMPLETED"
      });

    } catch (extractError: any) {
      console.error("Content extraction error:", extractError);
      return res.status(400).json({
        error: "Failed to process document content",
        details: extractError.message
      });
    }

  } catch (error: any) {
    console.error("Document upload error:", error);
    return res.status(500).json({ 
      error: "Failed to process document",
      details: error.message
    });
  }
});

// Delete document endpoint
router.delete("/api/workflow/documents/:id", async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log('Attempting to delete document:', {
      documentId,
      userId,
      timestamp: new Date().toISOString()
    });

    const [deletedDoc] = await db
      .delete(documents)
      .where(eq(documents.id, documentId) && eq(documents.userId, userId))
      .returning();

    if (!deletedDoc) {
      console.log('No document found to delete');
      return res.status(404).json({ error: "Document not found or already deleted" });
    }

    console.log('Document deleted successfully:', {
      documentId,
      timestamp: new Date().toISOString()
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Document deletion error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Get requirement suggestions
router.post("/api/templates/:id/suggest-requirements", async (req, res) => {
  try {
    const templateId = req.params.id;
    const { currentDescription } = req.body;

    console.log(`[Templates] Generating suggestions for template: ${templateId}`, {
      templateId,
      currentDescription
    });

    const suggestions = await suggestRequirements(templateId, currentDescription);

    console.log(`[Templates] Generated ${suggestions.length} suggestions:`, 
      JSON.stringify(suggestions, null, 2)
    );

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

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=${doc.title.replace(/\s+/g, '_')}.txt`);
    res.send(doc.content);

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

    console.log(`[Templates] Generating suggestions for template: ${templateId}`, {
      templateId,
      currentDescription
    });

    const suggestions = await suggestRequirements(templateId, currentDescription);

    console.log(`[Templates] Generated ${suggestions.length} suggestions:`, 
      JSON.stringify(suggestions, null, 2)
    );

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

// Approval Analysis endpoint
router.post("/api/workflow/approval-analysis", async (req, res) => {
  try {
    const { documentContent } = req.body;

    if (!documentContent) {
      return res.status(400).json({
        error: "Missing document content",
        code: "INVALID_INPUT"
      });
    }

    const result = await approvalAuditService.performApprovalAnalysis(documentContent);
    return res.json(result);
  } catch (error: any) {
    console.error("[Approval Analysis] Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to perform approval analysis",
      code: "ANALYSIS_ERROR"
    });
  }
});

// Final Audit endpoint
router.post("/api/workflow/final-audit", async (req, res) => {
  try {
    const { documentContent, workflowHistory } = req.body;

    if (!documentContent) {
      return res.status(400).json({
        error: "Missing document content",
        code: "INVALID_INPUT"
      });
    }

    const result = await approvalAuditService.generateFinalAudit(
      documentContent,
      workflowHistory
    );
    return res.json(result);
  } catch (error: any) {
    console.error("[Final Audit] Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate final audit",
      code: "AUDIT_ERROR"
    });
  }
});

// Risk Scorecard endpoint
router.post("/api/workflow/risk-scorecard", async (req, res) => {
  try {
    const { documentContent } = req.body;

    if (!documentContent) {
      return res.status(400).json({
        error: "Missing document content",
        code: "INVALID_INPUT"
      });
    }

    const result = await approvalAuditService.getRiskScorecard(documentContent);
    return res.json(result);
  } catch (error: any) {
    console.error("[Risk Scorecard] Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate risk scorecard",
      code: "SCORECARD_ERROR"
    });
  }
});

// Add this new endpoint after the existing routes
router.post("/api/templates/:id/custom-instruction-suggestions", async (req, res) => {
  try {
    const templateId = req.params.id;
    const { currentRequirements } = req.body;

    if (!Array.isArray(currentRequirements)) {
      return res.status(400).json({
        error: "Current requirements must be an array",
        code: "INVALID_INPUT"
      });
    }

    console.log(`[Templates] Generating custom instruction suggestions for template: ${templateId}`, {
      templateId,
      requirementsCount: currentRequirements.length
    });

    const suggestions = await getCustomInstructionSuggestions(templateId, currentRequirements);

    console.log(`[Templates] Generated ${suggestions.length} custom instruction suggestions:`,
      JSON.stringify(suggestions, null, 2)
    );

    return res.json(suggestions);
  } catch (error: any) {
    console.error("[Templates] Custom instruction suggestion error:", error);
    return res.status(500).json({ 
      error: "Failed to generate custom instruction suggestions",
      code: "SUGGESTION_ERROR",
      details: error.message 
    });
  }
});

export default router;