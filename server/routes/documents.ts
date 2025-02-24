import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { documents } from "@shared/schema";
import { documentProcessor } from "../services/documentProcessor";
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { pdfService } from "../services/pdf-service";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configure multer for document uploads
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
    ];

    if (
      allowedTypes.includes(file.mimetype) ||
      file.originalname.toLowerCase().endsWith(".pdf")
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type: ${file.mimetype}. Only PDF and Word documents are supported.`,
        ),
      );
    }
  },
});

// Enhanced error handling middleware
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

router.post(
  "/workflow/upload",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded",
        code: "NO_FILE",
      });
    }

    console.log("Processing upload:", {
      filename: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
    });

    try {
      // Use documentProcessor here
      const result = await documentProcessor.processDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );

      if (!result.success || !result.content) {
        throw new Error("Failed to extract content from document");
      }

      // Initial analysis with GPT-4o
      const analysisResponse = await openai.chat.completions.create({
        model: "gpt-4o", // Latest GPT-4o model
        messages: [
          {
            role: "system",
            content:
              "You are a legal document analyzer. Analyze the document and provide a structured analysis.",
          },
          {
            role: "user",
            content: result.content,
          },
        ],
        response_format: { type: "json_object" },
      });

      const analysis = JSON.parse(analysisResponse.choices[0].message.content);

      // Create document record
      const [document] = await db
        .insert(documents)
        .values({
          userId: req.user?.id || 1,
          title: req.file.originalname,
          content: result.content,
          processingStatus: "PROCESSING",
          agentType: "LEGAL_RESEARCH",
          analysis: {
            ...analysis,
            metadata: result.metadata,
            processingSteps: ["upload", "extraction", "initial_analysis"],
            uploadTimestamp: new Date().toISOString(),
          },
        })
        .returning();

      console.log("Document processed successfully:", {
        id: document.id,
        title: document.title,
        contentLength: result.content.length,
        processingTime: result.metadata?.processingTime,
      });

      return res.json({
        success: true,
        documentId: document.id,
        title: document.title,
        status: "PROCESSING",
        metadata: result.metadata,
        message: "Document uploaded and processing started",
      });
    } catch (error: any) {
      console.error("Document processing error:", {
        error: error.message,
        stack: error.stack,
      });

      return res.status(400).json({
        error: "Failed to process document",
        details: error.message,
        code: "PROCESSING_ERROR",
      });
    }
  }),
);

router.post("/templates/generate", async (req, res) => {
  try {
    console.log("[Templates] Starting template generation process");
    const count = await generateAllTemplates();
    console.log("[Templates] Successfully generated templates:", count);

    const templates = await db.select().from(contractTemplates);
    console.log("[Templates] Current template count:", templates.length);

    return res.json({
      success: true,
      count,
      message: `Successfully generated ${count} templates`,
    });
  } catch (error: any) {
    console.error("[Templates] Generation error:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate templates",
      code: "GENERATION_ERROR",
    });
  }
});

router.get("/templates", async (_req, res) => {
  try {
    console.log("[Templates] Fetching all templates");

    const templates = await db.select().from(contractTemplates);
    console.log(`[Templates] Found ${templates.length} templates`);

    if (!templates || templates.length === 0) {
      console.log("[Templates] No templates available");
      return res.status(404).json({
        error: "No templates available",
        code: "NO_TEMPLATES",
      });
    }

    const groupedTemplates = templates.reduce(
      (acc, template) => {
        const category = template.category;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(template);
        return acc;
      },
      {} as Record<string, typeof templates>,
    );

    return res.json({
      templates: groupedTemplates,
      totalCount: templates.length,
    });
  } catch (error: any) {
    console.error("[Templates] Error fetching templates:", error);
    return res.status(500).json({
      error: "Failed to fetch templates",
      code: "TEMPLATE_FETCH_ERROR",
      details: error.message,
    });
  }
});

router.post("/analyze/draft", async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        error: "Missing content",
        code: "INVALID_INPUT",
      });
    }

    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1024,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `Analyze this document comprehensively and provide a detailed structured analysis including:

1. Document Overview
   - Type of document
   - Primary purpose
   - Target audience

2. Structure Analysis
   - Organization and formatting
   - Section breakdown
   - Flow and coherence

3. Content Evaluation
   - Key sections and their purposes
   - Critical clauses and implications
   - Language and terminology used

4. Compliance Assessment
   - Regulatory alignment
   - Industry standard adherence
   - Potential compliance gaps

5. Quality Analysis
   - Overall document quality
   - Areas for improvement
   - Missing or recommended sections

6. Risk Identification
   - Key risks and exposures
   - Liability concerns
   - Mitigation recommendations

Please analyze this content:

${content}`,
        },
      ],
    });

    const analysis = response.content[0].text;

    return res.json({ analysis });
  } catch (error: any) {
    console.error("[Draft Analysis] Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to analyze document",
      code: "ANALYSIS_ERROR",
    });
  }
});

const upload2 = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type: ${file.mimetype}. Only PDF and Word documents are supported.`,
        ),
      );
    }
  },
});

router.post("/documents/generate", async (req, res) => {
  try {
    const { templateId, requirements, customInstructions } = req.body;

    if (!templateId || !requirements || !Array.isArray(requirements)) {
      return res.status(400).json({
        error: "Missing template ID or requirements",
        code: "INVALID_INPUT",
      });
    }

    console.log("[Contract Generation] Starting with:", {
      templateId,
      requirementsCount: requirements.length,
    });

    const contractText = await generateContract(
      templateId,
      requirements,
      customInstructions,
    );

    console.log("[Contract Generation] Contract generated successfully");

    const template = getTemplate(templateId);
    const title = template
      ? `${template.name} - Generated`
      : "Generated Contract";

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
            requirements,
          },
        },
      })
      .returning();

    console.log("[Contract Generation] Saved with ID:", document.id);

    return res.json({
      id: document.id,
      title,
      content: contractText,
    });
  } catch (error: any) {
    console.error("[Contract Generation] Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate contract",
      code: "GENERATION_ERROR",
    });
  }
});

router.delete("/workflow/documents/:id", async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("Attempting to delete document:", {
      documentId,
      userId,
      timestamp: new Date().toISOString(),
    });

    const [deletedDoc] = await db
      .delete(documents)
      .where(eq(documents.id, documentId) && eq(documents.userId, userId))
      .returning();

    if (!deletedDoc) {
      console.log("No document found to delete");
      return res
        .status(404)
        .json({ error: "Document not found or already deleted" });
    }

    console.log("Document deleted successfully:", {
      documentId,
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Document deletion error:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.post("/templates/:id/suggest-requirements", async (req, res) => {
  try {
    const templateId = req.params.id;
    const { currentDescription } = req.body;

    console.log(
      `[Templates] Generating suggestions for template: ${templateId}`,
      {
        templateId,
        currentDescription,
      },
    );

    const suggestions = await suggestRequirements(
      templateId,
      currentDescription,
    );

    console.log(
      `[Templates] Generated ${suggestions.length} suggestions:`,
      JSON.stringify(suggestions, null, 2),
    );

    return res.json(suggestions);
  } catch (error: any) {
    console.error("[Templates] Suggestion error:", error);
    return res.status(500).json({
      error: "Failed to generate suggestions",
      code: "SUGGESTION_ERROR",
      details: error.message,
    });
  }
});

router.get("/templates/:id/autocomplete", async (req, res) => {
  try {
    const templateId = req.params.id;
    const partialText = req.query.text as string;

    if (!partialText) {
      return res.status(400).json({
        error: "Missing partial text",
        code: "INVALID_INPUT",
      });
    }

    console.log(`[Templates] Getting autocomplete for: ${partialText}`);

    const suggestions = await getAutocomplete(templateId, partialText);

    console.log(
      `[Templates] Generated ${suggestions.suggestions.length} autocomplete suggestions`,
    );

    return res.json(suggestions);
  } catch (error: any) {
    console.error("[Templates] Autocomplete error:", error);
    return res.status(500).json({
      error: "Failed to get autocomplete suggestions",
      code: "AUTOCOMPLETE_ERROR",
      details: error.message,
    });
  }
});

router.get("/documents/:id/download/docx", async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.setHeader("Content-Type", "text/plain");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${doc.title.replace(/\s+/g, "_")}.txt`,
    );
    res.send(doc.content);
  } catch (error) {
    console.error("Error generating DOCX:", error);
    res.status(500).json({ error: "Failed to generate DOCX file" });
  }
});

router.get("/documents/:id/download/pdf", async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const pdfDoc = await pdfService.generatePDF(doc.content, {
      title: doc.title,
      author: "System Generated",
      subject: "Document Export",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${doc.title.replace(/\s+/g, "_")}.pdf`,
    );
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF file" });
  }
});

router.post(
  "/templates/:id/custom-instruction-suggestions",
  async (req, res) => {
    try {
      const templateId = req.params.id;
      const { currentRequirements } = req.body;

      if (!Array.isArray(currentRequirements)) {
        return res.status(400).json({
          error: "Current requirements must be an array",
          code: "INVALID_INPUT",
        });
      }

      console.log(
        `[Templates] Generating custom instruction suggestions for template: ${templateId}`,
        {
          templateId,
          requirementsCount: currentRequirements.length,
        },
      );

      const suggestions = await getCustomInstructionSuggestions(
        templateId,
        currentRequirements,
      );

      console.log(
        `[Templates] Generated ${suggestions.length} custom instruction suggestions:`,
        JSON.stringify(suggestions, null, 2),
      );

      return res.json(suggestions);
    } catch (error: any) {
      console.error("[Templates] Custom instruction suggestion error:", error);
      return res.status(500).json({
        error: "Failed to generate custom instruction suggestions",
        code: "SUGGESTION_ERROR",
        details: error.message,
      });
    }
  },
);

router.post("/workflow/approval-analysis", async (req, res) => {
  try {
    const { documentContent } = req.body;

    if (!documentContent) {
      return res.status(400).json({
        error: "Missing document content",
        code: "INVALID_INPUT",
      });
    }

    const result =
      await approvalAuditService.performApprovalAnalysis(documentContent);
    return res.json(result);
  } catch (error: any) {
    console.error("[Approval Analysis] Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to perform approval analysis",
      code: "ANALYSIS_ERROR",
    });
  }
});

router.post("/workflow/final-audit", async (req, res) => {
  try {
    const { documentContent, workflowHistory } = req.body;

    if (!documentContent) {
      return res.status(400).json({
        error: "Missing document content",
        code: "INVALID_INPUT",
      });
    }

    const result = await approvalAuditService.generateFinalAudit(
      documentContent,
      workflowHistory,
    );
    return res.json(result);
  } catch (error: any) {
    console.error("[Final Audit] Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate final audit",
      code: "AUDIT_ERROR",
    });
  }
});

router.post("/workflow/risk-scorecard", async (req, res) => {
  try {
    const { documentContent } = req.body;

    if (!documentContent) {
      return res.status(400).json({
        error: "Missing document content",
        code: "INVALID_INPUT",
      });
    }

    const result = await approvalAuditService.getRiskScorecard(documentContent);
    return res.json(result);
  } catch (error: any) {
    console.error("[Risk Scorecard] Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate risk scorecard",
      code: "SCORECARD_ERROR",
    });
  }
});

export default router;