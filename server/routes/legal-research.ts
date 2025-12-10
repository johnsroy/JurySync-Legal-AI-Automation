import { Router } from "express";
import { db } from "../db";
import { legalResearchReports, legalDocuments, legalAnalyses } from "@shared/schema";
import { generateLegalResearch, analyzeLegalDocumentContent } from "../services/legal-research-service";
import { z } from "zod";
import { desc, eq, and, gte, lte } from 'drizzle-orm';

const router = Router();

// Validation schemas
const researchRequestSchema = z.object({
  query: z.string().min(1, "Query is required"),
  filters: z.object({
    jurisdiction: z.string().optional(),
    legalTopic: z.string().optional(),
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional()
    }).optional()
  }).optional()
});

const documentAnalysisRequestSchema = z.object({
  content: z.string().min(1, "Document content is required")
});

// Get available research filters
router.get("/filters", async (req, res) => {
  try {
    console.log("Fetching available filters");
    const [jurisdictions, topics] = await Promise.all([
      db.select({
        jurisdiction: legalDocuments.jurisdiction
      })
      .from(legalDocuments)
      .groupBy(legalDocuments.jurisdiction),

      db.select({
        topic: legalDocuments.legalTopic
      })
      .from(legalDocuments)
      .groupBy(legalDocuments.legalTopic)
    ]);

    console.log("Retrieved filters:", {
      jurisdictions: jurisdictions.length,
      topics: topics.length
    });

    return res.json({
      success: true,
      filters: {
        jurisdictions: jurisdictions.map(j => j.jurisdiction).filter(Boolean),
        legalTopics: topics.map(t => t.topic).filter(Boolean)
      }
    });
  } catch (error) {
    console.error("Error fetching filters:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch filters"
    });
  }
});

// Error handling middleware
router.use((err: any, req: any, res: any, next: any) => {
  console.error('Legal Research Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || "Research failed",
    details: err.stack
  });
});

// Main research endpoint
router.post("/analyze", async (req, res) => {
  try {
    console.log("Received research request:", req.body);

    const validatedData = researchRequestSchema.parse(req.body);
    console.log("Validated request data:", validatedData);

    // Build query conditions
    const whereConditions = [];

    if (validatedData.filters?.jurisdiction && validatedData.filters.jurisdiction !== 'all') {
      whereConditions.push(eq(legalDocuments.jurisdiction, validatedData.filters.jurisdiction));
    }

    if (validatedData.filters?.legalTopic && validatedData.filters.legalTopic !== 'all') {
      whereConditions.push(eq(legalDocuments.legalTopic, validatedData.filters.legalTopic));
    }

    if (validatedData.filters?.dateRange?.start) {
      whereConditions.push(gte(legalDocuments.date, new Date(validatedData.filters.dateRange.start)));
    }

    if (validatedData.filters?.dateRange?.end) {
      whereConditions.push(lte(legalDocuments.date, new Date(validatedData.filters.dateRange.end)));
    }

    console.log("Constructed where conditions:", whereConditions);

    // Find relevant documents
    const relevantDocs = await db.select({
      id: legalDocuments.id,
      title: legalDocuments.title,
      jurisdiction: legalDocuments.jurisdiction,
      legalTopic: legalDocuments.legalTopic,
      date: legalDocuments.date,
      documentType: legalDocuments.documentType,
      content: legalDocuments.content,
      metadata: legalDocuments.metadata
    })
    .from(legalDocuments)
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(desc(legalDocuments.date))
    .limit(20);

    console.log('Found relevant documents:', relevantDocs.length);

    // Generate research using OpenAI
    const researchResults = await generateLegalResearch(
      validatedData.query,
      validatedData.filters || {},
      relevantDocs.map(doc => ({
        title: doc.title,
        content: doc.content,
        citation: doc.metadata?.citation
      }))
    );

    // Store results if user is authenticated
    if (req.user?.id) {
      await db.insert(legalResearchReports).values({
        userId: req.user.id,
        query: validatedData.query,
        jurisdiction: validatedData.filters?.jurisdiction || 'all',
        legalTopic: validatedData.filters?.legalTopic || 'all',
        results: researchResults,
        dateRange: validatedData.filters?.dateRange || null
      });
    }

    return res.json({
      success: true,
      ...researchResults
    });

  } catch (error: any) {
    console.error("Legal Research Error:", {
      error,
      stack: error.stack,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: error.message || "Research failed",
      details: error.message
    });
  }
});

// Document analysis endpoint - replaces client-side OpenAI calls
router.post("/analyze-document", async (req, res) => {
  try {
    console.log("Received document analysis request");

    const validatedData = documentAnalysisRequestSchema.parse(req.body);

    if (!validatedData.content || validatedData.content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "No content provided for analysis"
      });
    }

    console.log("Analyzing document with content length:", validatedData.content.length);

    // Analyze the document using the backend service
    const analysis = await analyzeLegalDocumentContent(validatedData.content);

    // Store analysis if user is authenticated
    if (req.user?.id) {
      try {
        await db.insert(legalAnalyses).values({
          userId: req.user.id,
          documentContent: validatedData.content.substring(0, 10000), // Truncate for storage
          analysis: analysis,
          timestamp: new Date()
        });
      } catch (storeError) {
        console.warn("Failed to store analysis:", storeError);
        // Continue even if storage fails
      }
    }

    return res.json({
      success: true,
      ...analysis
    });

  } catch (error: any) {
    console.error("Document Analysis Error:", {
      error,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: error.message || "Document analysis failed"
    });
  }
});

export default router;