import { Router } from "express";
import { db } from "../db";
import { legalResearchReports, legalDocuments } from "@shared/schema";
import { generateDeepResearch } from "../services/gemini-service";
import { z } from "zod";
import { desc, eq, and, gte, lte, ilike, or } from 'drizzle-orm';

const router = Router();

// Validation schemas
const researchRequestSchema = z.object({
  query: z.string().min(1, "Query is required"),
  jurisdiction: z.string().optional(),
  legalTopic: z.string().optional(),
  dateRange: z.object({
    start: z.string().optional(),
    end: z.string().optional()
  }).optional()
});

// Get example queries for new users
router.get("/examples", async (req, res) => {
  try {
    const exampleQueries = [
      {
        id: 1,
        query: "What are the recent developments in state constitutional privacy rights?",
        jurisdiction: "State",
        legalTopic: "Constitutional"
      },
      {
        id: 2,
        query: "Analyze the evolution of environmental protection measures at the state level",
        jurisdiction: "State",
        legalTopic: "Environmental"
      },
      {
        id: 3,
        query: "Recent precedents in corporate governance regulations",
        jurisdiction: "State",
        legalTopic: "Corporate"
      },
      {
        id: 4,
        query: "Criminal law developments in federal courts",
        jurisdiction: "Federal",
        legalTopic: "Criminal"
      },
      {
        id: 5,
        query: "Civil rights cases in education sector",
        jurisdiction: "Supreme Court",
        legalTopic: "Civil Rights"
      }
    ];

    // Fetch recent successful queries from the database
    const recentQueries = await db.select({
      id: legalResearchReports.id,
      query: legalResearchReports.query,
      jurisdiction: legalResearchReports.jurisdiction,
      legalTopic: legalResearchReports.legalTopic
    })
    .from(legalResearchReports)
    .orderBy(desc(legalResearchReports.timestamp))
    .limit(5);

    return res.json({ 
      success: true,
      examples: exampleQueries,
      recentQueries
    });
  } catch (error) {
    console.error("Error fetching example queries:", error);
    return res.status(500).json({ 
      success: false,
      error: "Failed to fetch example queries" 
    });
  }
});

// Main research endpoint
router.post("/", async (req, res) => {
  try {
    const validatedData = researchRequestSchema.parse(req.body);
    console.log('Starting legal research:', validatedData);

    // Build where conditions for the query
    const whereConditions = [];

    if (validatedData.jurisdiction) {
      whereConditions.push(eq(legalDocuments.jurisdiction, validatedData.jurisdiction));
    }

    if (validatedData.legalTopic) {
      whereConditions.push(eq(legalDocuments.legalTopic, validatedData.legalTopic));
    }

    if (validatedData.dateRange?.start) {
      whereConditions.push(gte(legalDocuments.date, new Date(validatedData.dateRange.start)));
    }

    if (validatedData.dateRange?.end) {
      whereConditions.push(lte(legalDocuments.date, new Date(validatedData.dateRange.end)));
    }

    // Add content search condition with broader search
    whereConditions.push(
      or(
        ilike(legalDocuments.content, `%${validatedData.query}%`),
        ilike(legalDocuments.title, `%${validatedData.query}%`),
        ilike(legalDocuments.metadata.citation, `%${validatedData.query}%`)
      )
    );

    // Find relevant documents with improved limit
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
    .where(and(...whereConditions))
    .orderBy(desc(legalDocuments.date))
    .limit(20);

    console.log('Found relevant documents:', relevantDocs.length);

    if (relevantDocs.length === 0) {
      return res.json({
        success: true,
        executiveSummary: "No matching documents found for the given criteria.",
        findings: [],
        recommendations: ["Try broadening your search criteria", "Remove some filters to see more results"],
        relevantDocuments: []
      });
    }

    // Generate research using Gemini
    const researchResults = await generateDeepResearch(validatedData.query, {
      jurisdiction: validatedData.jurisdiction,
      legalTopic: validatedData.legalTopic,
      dateRange: validatedData.dateRange,
      relevantDocs
    });

    // Store results
    await db.insert(legalResearchReports).values({
      query: validatedData.query,
      jurisdiction: validatedData.jurisdiction || 'All',
      legalTopic: validatedData.legalTopic || 'All',
      results: researchResults,
      dateRange: validatedData.dateRange || null,
      timestamp: new Date()
    });

    return res.json({
      success: true,
      executiveSummary: researchResults.executiveSummary,
      findings: researchResults.findings,
      recommendations: researchResults.recommendations,
      relevantDocuments: relevantDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        jurisdiction: doc.jurisdiction,
        topic: doc.legalTopic,
        date: doc.date,
        type: doc.documentType,
        citation: doc.metadata?.citation,
        content: doc.content.substring(0, 300) + '...' // Include longer preview
      }))
    });

  } catch (error: any) {
    console.error("Legal research error:", error);
    return res.status(500).json({
      success: false,
      error: "Research failed",
      details: error.message || "Unknown error occurred"
    });
  }
});

// Get available research filters
router.get("/filters", async (req, res) => {
  try {
    // Get unique jurisdictions and topics from existing documents
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

    const filters = {
      jurisdictions: jurisdictions
        .map(j => j.jurisdiction)
        .filter(Boolean)
        .sort(),
      legalTopics: topics
        .map(t => t.topic)
        .filter(Boolean)
        .sort()
    };

    return res.json({
      success: true,
      filters
    });
  } catch (error) {
    console.error("Error fetching filters:", error);
    return res.status(500).json({
      success: false, 
      error: "Failed to fetch available filters"
    });
  }
});

export default router;