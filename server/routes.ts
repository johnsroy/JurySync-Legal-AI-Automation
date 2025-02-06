import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeDocument } from "./openai";
import { insertDocumentSchema } from "@shared/schema";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Document routes
  app.get("/api/documents", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const documents = await storage.getDocuments(req.user!.id);
    res.json(documents);
  });

  app.get("/api/documents/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const document = await storage.getDocument(parseInt(req.params.id));
    if (!document || document.userId !== req.user!.id) {
      return res.sendStatus(404);
    }
    res.json(document);
  });

  app.post("/api/documents", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = insertDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        message: "Invalid document data",
        code: "VALIDATION_ERROR" 
      });
    }

    try {
      const analysis = await analyzeDocument(parsed.data.content);
      const document = await storage.createDocument({
        ...parsed.data,
        userId: req.user!.id,
        analysis,
      });

      res.status(201).json(document);
    } catch (error) {
      console.error('Document analysis error:', error);
      return res.status(500).json({ 
        message: "Failed to analyze document. Please try again later.",
        code: "ANALYSIS_ERROR"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}