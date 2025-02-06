import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeDocument } from "./openai";
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

async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  try {
    switch (file.mimetype) {
      case 'application/pdf':
        const pdfData = await pdfParse(file.buffer);
        return pdfData.text;

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return result.value;

      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel':
        const workbook = XLSX.read(file.buffer);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_txt(worksheet);

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

      const content = await extractTextFromFile(req.file);
      const document = {
        title: req.body.title || req.file.originalname,
        content,
      };

      const parsed = insertDocumentSchema.parse(document);
      console.log("Analyzing document content:", content.substring(0, 100) + "...");
      const analysis = await analyzeDocument(content);

      const createdDocument = await storage.createDocument({
        ...parsed,
        content,
        userId: req.user!.id,
        analysis,
      });

      res.status(201).json(createdDocument);
    } catch (error) {
      console.error('Document creation error:', error);

      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: fromZodError(error).message,
          code: "VALIDATION_ERROR"
        });
      }

      if (error instanceof Error && error.message === 'Invalid file type') {
        return res.status(400).json({
          message: "Invalid file type. Please upload PDF, DOCX, DOC, or XLSX files only.",
          code: "FILE_TYPE_ERROR"
        });
      }

      if (error instanceof Error && error.message.includes('OpenAI')) {
        return res.status(503).json({ 
          message: "Failed to analyze document. Please try again later.",
          code: "ANALYSIS_ERROR"
        });
      }

      res.status(500).json({ 
        message: "Failed to create document",
        code: "CREATE_ERROR"
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

  const httpServer = createServer(app);
  return httpServer;
}