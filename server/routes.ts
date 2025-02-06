import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeDocument, chatWithDocument } from "./openai";
import { insertDocumentSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import pdf from "pdf-parse/lib/pdf-parse.js";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { openai } from "./openai"; //Import openai for new endpoints

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

interface ExtractedContent {
  text: string;
  sections: {
    title: string;
    content: string;
    level: number;
  }[];
  metadata: {
    title?: string;
    author?: string;
    creationDate?: string;
    lastModified?: string;
  };
}

async function extractTextFromFile(file: Express.Multer.File): Promise<ExtractedContent> {
  try {
    switch (file.mimetype) {
      case 'application/pdf': {
        const pdfData = await pdf(file.buffer);
        const sections = [];
        let currentSection = { title: '', content: '', level: 1 };

        // Enhanced PDF parsing logic for better structure detection
        const lines = pdfData.text.split('\n');
        let inHeader = true;
        let headerText = '';

        for (const line of lines) {
          // Detect headers based on various patterns common in legal documents
          const isHeader = (
            line.match(/^[A-Z\d]+[\.\)]\s+[A-Z]/) ||  // "1. SECTION" or "A) SECTION"
            line.match(/^[A-Z][A-Z\s]{4,}/) ||        // "SECTION TITLE"
            line.match(/^Article\s+\d+/i) ||           // "Article 1"
            line.match(/^Section\s+\d+/i)              // "Section 1"
          );

          if (isHeader) {
            // Save previous section if exists
            if (currentSection.content.trim()) {
              sections.push(currentSection);
            }
            currentSection = {
              title: line.trim(),
              content: '',
              level: line.search(/\S/) / 2, // Indentation level
            };
            inHeader = true;
            headerText = line;
          } else {
            if (inHeader && line.trim()) {
              // This line is part of the header
              headerText += ' ' + line.trim();
            } else if (line.trim()) {
              // Regular content
              inHeader = false;
              currentSection.content += line + '\n';
            }
          }
        }

        // Add the last section
        if (currentSection.content.trim()) {
          sections.push(currentSection);
        }

        return {
          text: pdfData.text,
          sections,
          metadata: {
            title: pdfData.info?.Title,
            author: pdfData.info?.Author,
            creationDate: pdfData.info?.CreationDate,
            lastModified: pdfData.info?.ModDate,
          }
        };
      }

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword': {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        const sections = [];
        let currentSection = { title: '', content: '', level: 1 };

        const lines = result.value.split('\n');
        for (const line of lines) {
          if (line.match(/^[A-Z\d]+[\.\)]\s+[A-Z]/)) {
            if (currentSection.content) {
              sections.push(currentSection);
            }
            currentSection = {
              title: line.trim(),
              content: '',
              level: 1
            };
          } else {
            currentSection.content += line + '\n';
          }
        }
        if (currentSection.content) {
          sections.push(currentSection);
        }

        return {
          text: result.value,
          sections,
          metadata: {}
        };
      }

      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel': {
        const workbook = XLSX.read(file.buffer);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const text = XLSX.utils.sheet_to_txt(worksheet);

        const sections = text.split('\n')
          .filter(line => line.trim())
          .map(line => ({
            title: line.split('\t')[0] || 'Untitled Section',
            content: line,
            level: 1
          }));

        return {
          text,
          sections,
          metadata: {
            title: workbook.Props?.Title,
            author: workbook.Props?.Author,
            lastModified: workbook.Props?.ModifiedDate?.toString(),
          }
        };
      }

      default:
        throw new Error('Unsupported file type');
    }
  } catch (error) {
    console.error('Error extracting text:', error);
    throw error;
  }
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  app.post("/api/documents", upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "You must be logged in to create documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          message: "No file uploaded",
          code: "FILE_REQUIRED"
        });
      }

      let extractedContent: ExtractedContent;
      try {
        extractedContent = await extractTextFromFile(req.file);
        if (!extractedContent.text || extractedContent.text.trim().length === 0) {
          throw new Error("Empty document content");
        }
      } catch (error) {
        console.error('Text extraction error:', error);
        return res.status(400).json({
          message: "Failed to extract text from document. Please ensure the file is not corrupted or empty.",
          code: "EXTRACTION_ERROR"
        });
      }

      const document = {
        title: req.body.title || extractedContent.metadata.title || req.file.originalname,
        content: extractedContent.text,
        agentType: req.body.agentType || "CONTRACT_AUTOMATION",
      };

      let parsed;
      try {
        parsed = insertDocumentSchema.parse(document);
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({ 
            message: fromZodError(error).message,
            code: "VALIDATION_ERROR"
          });
        }
        throw error;
      }

      let analysis;
      try {
        console.log("Processing document with agent:", parsed.agentType);
        // Pass the structured content to the analysis
        analysis = await analyzeDocument(
          extractedContent.text,
          parsed.agentType,
          extractedContent.sections
        );
      } catch (error) {
        console.error('Analysis error:', error);
        return res.status(503).json({ 
          message: "Our AI system is currently experiencing high load. Please try again in a few moments.",
          code: "ANALYSIS_ERROR"
        });
      }

      try {
        const createdDocument = await storage.createDocument({
          ...parsed,
          content: extractedContent.text,
          userId: req.user!.id,
          analysis,
          metadata: extractedContent.metadata
        });

        res.status(201).json(createdDocument);
      } catch (error) {
        console.error('Storage error:', error);
        return res.status(500).json({ 
          message: "Failed to save document",
          code: "STORAGE_ERROR"
        });
      }

    } catch (error) {
      console.error('Document creation error:', error);

      if (error instanceof Error && error.message === 'Invalid file type') {
        return res.status(400).json({
          message: "Invalid file type. Please upload PDF, DOCX, DOC, or XLSX files only.",
          code: "FILE_TYPE_ERROR"
        });
      }

      res.status(500).json({ 
        message: "An unexpected error occurred while processing your document",
        code: "UNKNOWN_ERROR"
      });
    }
  });

  app.get("/api/documents", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "You must be logged in to access documents",
        code: "NOT_AUTHENTICATED"
      });
    }
    try {
      const documents = await storage.getDocuments(req.user!.id);
      res.json(documents);
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ 
        message: "Failed to fetch documents",
        code: "FETCH_ERROR"
      });
    }
  });

  app.get("/api/documents/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "You must be logged in to access documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({ 
          message: "Invalid document ID",
          code: "INVALID_ID"
        });
      }

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ 
          message: "Document not found",
          code: "NOT_FOUND"
        });
      }

      if (document.userId !== req.user!.id) {
        return res.status(403).json({ 
          message: "You don't have permission to access this document",
          code: "FORBIDDEN"
        });
      }

      res.json(document);
    } catch (error) {
      console.error('Error fetching document:', error);
      res.status(500).json({ 
        message: "Failed to fetch document",
        code: "FETCH_ERROR"
      });
    }
  });

  app.post("/api/documents/:id/chat", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "You must be logged in to access documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({ 
          message: "Invalid document ID",
          code: "INVALID_ID"
        });
      }

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ 
          message: "Document not found",
          code: "NOT_FOUND"
        });
      }

      if (document.userId !== req.user!.id) {
        return res.status(403).json({ 
          message: "You don't have permission to access this document",
          code: "FORBIDDEN"
        });
      }

      const { message, context } = req.body;
      const response = await chatWithDocument(message, context, document.analysis);
      res.json({ response });

    } catch (error) {
      console.error('Error in chat endpoint:', error);
      res.status(500).json({ 
        message: "Failed to process chat request",
        code: "CHAT_ERROR"
      });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "You must be logged in to delete documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({ 
          message: "Invalid document ID",
          code: "INVALID_ID"
        });
      }

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ 
          message: "Document not found",
          code: "NOT_FOUND"
        });
      }

      if (document.userId !== req.user!.id) {
        return res.status(403).json({ 
          message: "You don't have permission to delete this document",
          code: "FORBIDDEN"
        });
      }

      await storage.deleteDocument(documentId);
      res.sendStatus(204);
    } catch (error) {
      console.error('Error deleting document:', error);
      res.status(500).json({ 
        message: "Failed to delete document",
        code: "DELETE_ERROR"
      });
    }
  });

  // Generate contract draft
  app.post("/api/documents/:id/generate-draft", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "You must be logged in to access documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({ 
          message: "Invalid document ID",
          code: "INVALID_ID"
        });
      }

      const document = await storage.getDocument(documentId);
      if (!document || document.userId !== req.user!.id) {
        return res.status(403).json({ 
          message: "Access denied",
          code: "FORBIDDEN"
        });
      }

      // Generate draft using OpenAI with chunked requirements
      const requirements = req.body.requirements;
      const maxChunkLength = 4000; // Safe limit for gpt-3.5-turbo
      const chunks = requirements.match(new RegExp(`.{1,${maxChunkLength}}`, 'g')) || [];

      let fullDraft = '';
      for (const chunk of chunks) {
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a legal contract drafting assistant. Generate a professional contract section based on the provided requirements. Maintain consistency with any previous sections."
            },
            {
              role: "user",
              content: chunk
            }
          ],
          temperature: 0.7,
          max_tokens: 1500
        });

        fullDraft += response.choices[0].message.content + '\n';
      }

      // Update document with new draft
      const updatedDocument = await storage.createDocument({
        ...document,
        content: fullDraft,
        analysis: {
          ...document.analysis,
          contractDetails: {
            ...document.analysis.contractDetails,
            versionControl: {
              version: "1.0",
              changes: [{
                timestamp: new Date().toISOString(),
                user: req.user!.username,
                description: "Initial draft generated"
              }],
              previousVersions: []
            }
          }
        }
      });

      res.json(updatedDocument);
    } catch (error) {
      console.error('Error generating draft:', error);
      res.status(500).json({ 
        message: "Failed to generate draft",
        code: "GENERATION_ERROR"
      });
    }
  });

  // New endpoint for downloading contract
  app.get("/api/documents/:id/download", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "You must be logged in to access documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);

      if (!document || document.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if document is in an approved state
      const workflowState = document.analysis?.contractDetails?.workflowState;
      if (!workflowState || !['APPROVAL', 'SIGNATURE', 'COMPLETED'].includes(workflowState.status)) {
        return res.status(400).json({ 
          message: "Document must be approved before downloading",
          code: "NOT_APPROVED"
        });
      }

      // Format the content for download
      const formattedContent = `
Contract: ${document.title}
Generated on: ${new Date().toLocaleDateString()}
Status: ${workflowState.status}
Version: ${document.analysis.contractDetails?.versionControl?.version || '1.0'}

${document.content}
      `.trim();

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_v${document.analysis.contractDetails?.versionControl?.version || '1.0'}.txt"`);

      res.send(formattedContent);
    } catch (error) {
      console.error('Error downloading document:', error);
      res.status(500).json({ 
        message: "Failed to download document",
        code: "DOWNLOAD_ERROR"
      });
    }
  });

  app.post("/api/documents/:id/analyze-clause", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "You must be logged in to access documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);
      if (!document || document.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const clause = req.body.clause;
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a legal contract analysis assistant. Analyze the provided clause for potential risks and suggest improvements."
          },
          {
            role: "user",
            content: clause
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      const analysis = {
        suggestion: response.choices[0].message.content,
        riskLevel: Math.floor(Math.random() * 10) + 1, // This should be replaced with actual risk assessment logic
        timestamp: new Date().toISOString()
      };

      // Update document with analysis
      const updatedAnalysis = {
        ...document.analysis,
        contractDetails: {
          ...document.analysis.contractDetails,
          redlineHistory: [
            ...(document.analysis.contractDetails?.redlineHistory || []),
            {
              clause,
              ...analysis
            }
          ]
        }
      };

      await storage.createDocument({
        ...document,
        analysis: updatedAnalysis
      });

      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing clause:', error);
      res.status(500).json({ 
        message: "Failed to analyze clause",
        code: "ANALYSIS_ERROR"
      });
    }
  });

  // Handle workflow actions
  app.post("/api/documents/:id/workflow", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "You must be logged in to access documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);
      if (!document || document.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { action } = req.body;
      let newStatus;
      switch (action) {
        case "review":
          newStatus = "REVIEW";
          break;
        case "approve":
          newStatus = "APPROVAL";
          break;
        case "sign":
          newStatus = "SIGNATURE";
          break;
        default:
          return res.status(400).json({ message: "Invalid action" });
      }

      const updatedAnalysis = {
        ...document.analysis,
        contractDetails: {
          ...document.analysis.contractDetails,
          workflowState: {
            ...document.analysis.contractDetails?.workflowState,
            status: newStatus,
            comments: [
              ...(document.analysis.contractDetails?.workflowState?.comments || []),
              {
                user: req.user!.username,
                text: `Document sent for ${action}`,
                timestamp: new Date().toISOString()
              }
            ]
          }
        }
      };

      const updatedDocument = await storage.createDocument({
        ...document,
        analysis: updatedAnalysis
      });

      res.json(updatedDocument);
    } catch (error) {
      console.error('Error updating workflow:', error);
      res.status(500).json({ 
        message: "Failed to update workflow",
        code: "WORKFLOW_ERROR"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}