import { Router } from "express";
import { db } from "../db";
import { legalDocuments, legalResearchReports } from "@shared/schema";
import { generateDeepResearch } from "../services/gemini-service";
import { z } from "zod";
import { desc, eq, and, gte, lte, ilike, or } from "drizzle-orm";
import { generateEmbedding } from "../services/embedding-service";

const router = Router();

// Documents endpoint for getting pre-populated documents based on filters
router.get("/documents", async (req, res) => {
  try {
    const { jurisdiction, topic: legalTopic, startDate, endDate } = req.query;

    let conditions = [];

    // Add filter conditions
    if (jurisdiction && jurisdiction !== 'all') {
      conditions.push(eq(legalDocuments.jurisdiction, jurisdiction as string));
    }

    if (legalTopic && legalTopic !== 'all') {
      conditions.push(eq(legalDocuments.legalTopic, legalTopic as string));
    }

    if (startDate) {
      conditions.push(gte(legalDocuments.date, new Date(startDate as string)));
    }

    if (endDate) {
      conditions.push(lte(legalDocuments.date, new Date(endDate as string)));
    }

    const documents = await db
      .select()
      .from(legalDocuments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(legalDocuments.date))
      .limit(50);

    return res.json(documents);
  } catch (error: any) {
    console.error("Error fetching documents:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch documents",
      details: error.message
    });
  }
});

// Analyze endpoint for deep research
router.post("/analyze", async (req, res) => {
  try {
    const { query, filters, useDeepResearch } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Query is required"
      });
    }

    // Get relevant documents based on filters
    let conditions = [];
    if (filters) {
      if (filters.jurisdiction && filters.jurisdiction !== 'all') {
        conditions.push(eq(legalDocuments.jurisdiction, filters.jurisdiction));
      }
      if (filters.legalTopic && filters.legalTopic !== 'all') {
        conditions.push(eq(legalDocuments.legalTopic, filters.legalTopic));
      }
      if (filters.startDate) {
        conditions.push(gte(legalDocuments.date, new Date(filters.startDate)));
      }
      if (filters.endDate) {
        conditions.push(lte(legalDocuments.date, new Date(filters.endDate)));
      }
    }

    // Get all relevant documents
    const documents = await db
      .select()
      .from(legalDocuments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(legalDocuments.date))
      .limit(20);

    if (documents.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No relevant documents found for the given filters"
      });
    }

    // Generate research response using Gemini
    const researchResponse = await generateDeepResearch(query, documents);

    return res.json({
      success: true,
      summary: researchResponse.summary,
      analysis: researchResponse.analysis,
      citations: researchResponse.citations
    });

  } catch (error: any) {
    console.error("Analysis error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to analyze query",
      details: error.message
    });
  }
});

// Report generation endpoint
router.post("/report", async (req, res) => {
  try {
    const { result } = req.body;

    if (!result) {
      return res.status(400).json({
        success: false,
        error: "Research result is required"
      });
    }

    // Generate PDF report
    // For now, just return a JSON response
    return res.json({
      success: true,
      message: "Report generated successfully",
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Report generation error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate report",
      details: error.message
    });
  }
});

export default router;