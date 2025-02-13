import { Router } from "express";
import { documentAnalyticsService } from "../services/documentAnalytics";
import { db } from "../db";
import { vaultDocuments, vaultDocumentAnalysis } from "@shared/schema";
import { z } from 'zod';
import { DocumentAnalyticsService } from '../services/documentAnalytics';

const router = Router();
const documentAnalyticsServiceInstance = new DocumentAnalyticsService(); // Instance creation


// Validation schema for workflow results
const workflowResultSchema = z.array(z.object({
  stageType: z.enum(['classification', 'compliance', 'research']),
  content: z.string(),
  status: z.string().optional(),
  riskScore: z.number().optional()
}));

router.post('/process', async (req, res) => {
  try {
    const { workflowResults } = req.body;
    
    // Validate input
    const validatedResults = workflowResultSchema.parse(workflowResults);
    
    // Process the workflow results
    const metadata = await documentAnalyticsServiceInstance.processWorkflowResults(validatedResults);
    
    res.json(metadata);
  } catch (error) {
    console.error('Document analytics processing error:', error);
    res.status(500).json({
      error: 'Failed to process document analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get analysis for all documents in vault
router.get("/vault/analysis", async (req, res) => {
  try {
    const analysis = await db
      .select()
      .from(vaultDocumentAnalysis)
      .orderBy(vaultDocumentAnalysis.createdAt);

    res.json(analysis);
  } catch (error) {
    console.error("Error fetching vault analysis:", error);
    res.status(500).json({ error: "Failed to fetch vault analysis" });
  }
});

// Get analysis for a specific document
router.get("/vault/analysis/:documentId", async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const analysis = await documentAnalyticsServiceInstance.getDocumentAnalysis(documentId);

    if (!analysis) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    res.json(analysis);
  } catch (error) {
    console.error("Error fetching document analysis:", error);
    res.status(500).json({ error: "Failed to fetch document analysis" });
  }
});

// Analyze a document
router.post("/vault/analyze/:documentId", async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Document content is required" });
    }

    const analysis = await documentAnalyticsServiceInstance.analyzeDocument(documentId, content);
    res.json(analysis);
  } catch (error) {
    console.error("Error analyzing document:", error);
    res.status(500).json({ error: "Failed to analyze document" });
  }
});

export default router;