import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeDocument, chatWithDocument } from "./openai";
import { insertDocumentSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import * as pdfParse from "pdf-parse/lib/pdf-parse.js";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

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
        const pdfData = await pdfParse(file.buffer);
        const sections = [];
        let currentSection = { title: '', content: '', level: 1 };

        // Split by potential section headers
        const lines = pdfData.text.split('\n');
        for (const line of lines) {
          // Detect headers based on formatting (this is a simple example)
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

        // Split by potential section headers
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

        // For spreadsheets, treat each non-empty row as a section
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
            lastModified: workbook.Props?.ModifiedDate,
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

  const httpServer = createServer(app);
  return httpServer;
}