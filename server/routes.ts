import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeDocument } from "./openai";
import { insertDocumentSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Document routes
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

  app.post("/api/documents", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "You must be logged in to create documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const parsed = insertDocumentSchema.parse(req.body);
      const analysis = await analyzeDocument(parsed.content);

      const document = await storage.createDocument({
        ...parsed,
        userId: req.user!.id,
        analysis,
      });

      res.status(201).json(document);
    } catch (error) {
      console.error('Document creation error:', error);

      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: fromZodError(error).message,
          code: "VALIDATION_ERROR"
        });
      }

      // Handle OpenAI API errors
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

  const httpServer = createServer(app);
  return httpServer;
}