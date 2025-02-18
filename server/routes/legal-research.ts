import { Router } from "express";
import { db } from "../db";
import { legalDocuments, legalResearchReports } from "@shared/schema";
import { generateDeepResearch } from "../services/gemini-service";
import { z } from "zod";
import { desc, eq, and, gte, lte, ilike, or } from "drizzle-orm";
import { generateEmbedding } from "../services/embedding-service";

const router = Router();

// Main legal research endpoint
router.post("/", async (req, res) => {
  try {
    const { query, jurisdiction, legalTopic, dateRange, options } = req.body;

    if (!query || !jurisdiction || !legalTopic) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: query, jurisdiction, and legalTopic"
      });
    }

    let conditions = [];

    // Add filter conditions
    conditions.push(eq(legalDocuments.jurisdiction, jurisdiction));
    conditions.push(eq(legalDocuments.legalTopic, legalTopic));

    if (dateRange?.start) {
      conditions.push(gte(legalDocuments.date, new Date(dateRange.start)));
    }
    if (dateRange?.end) {
      conditions.push(lte(legalDocuments.date, new Date(dateRange.end)));
    }

    // Get relevant documents
    const documents = await db
      .select()
      .from(legalDocuments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(legalDocuments.date))
      .limit(20);

    if (documents.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No relevant documents found for the given criteria"
      });
    }

    // Generate research response using Gemini
    const researchResponse = await generateDeepResearch(query, documents);

    // Save research report
    const [report] = await db
      .insert(legalResearchReports)
      .values({
        userId: req.user?.id || 1, // Fallback for demo
        query,
        jurisdiction,
        legalTopic,
        results: researchResponse,
        dateRange: dateRange || {},
        searchType: options?.deepResearch ? "DEEP" : "NATURAL",
        timestamp: new Date(),
      })
      .returning();

    // Format the response to match frontend expectations
    const response = {
      results: researchResponse.documents.map(doc => ({
        title: doc.title,
        source: doc.source || doc.citation,
        relevance: Math.round(doc.relevance * 100),
        summary: doc.summary,
        citations: doc.citations || [],
        urls: doc.urls || []
      })),
      recommendations: researchResponse.recommendations || [],
      timestamp: report.timestamp.toISOString()
    };

    return res.json(response);

  } catch (error: any) {
    console.error("Legal research error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to process legal research query",
      details: error.message
    });
  }
});

// Suggest questions endpoint
router.post("/suggest-questions", async (req, res) => {
  try {
    const { query, jurisdiction, legalTopic } = req.body;

    if (!jurisdiction || !legalTopic) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: jurisdiction and legalTopic"
      });
    }

    // Generate suggested questions based on the context
    const suggestedQuestions = [
      `What are the key precedents in ${jurisdiction} regarding ${legalTopic}?`,
      `How has ${legalTopic} legislation evolved in ${jurisdiction}?`,
      `What are the current compliance requirements for ${legalTopic} in ${jurisdiction}?`,
      `Recent landmark cases in ${jurisdiction} affecting ${legalTopic}?`,
      `What are the standard practices for ${legalTopic} in ${jurisdiction}?`
    ];

    return res.json(suggestedQuestions);

  } catch (error: any) {
    console.error("Suggestion generation error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate suggestions",
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