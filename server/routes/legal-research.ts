import { Router } from "express";
import { db } from "../db";
import { legalResearchReports, legalDocuments } from "@shared/schema";
import { generateDeepResearch } from "../services/gemini-service";
import { z } from "zod";
import { desc, eq, and, gte, lte, ilike, or, like } from 'drizzle-orm';

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

// Get available research based on filters
router.get("/available", async (req, res) => {
  try {
    const { jurisdiction, legalTopic, startDate, endDate } = req.query;
    
    let conditions = [];
    
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

    const query = conditions.length > 0 
      ? db.select().from(legalDocuments).where(and(...conditions))
      : db.select().from(legalDocuments);

    const documents = await query.limit(100);

    return res.json({
      success: true,
      documents: documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        jurisdiction: doc.jurisdiction,
        legalTopic: doc.legalTopic,
        date: doc.date,
        summary: doc.content.substring(0, 200) + '...'
      }))
    });

  } catch (error) {
    console.error("Error fetching available research:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch available research"
    });
  }
});

// Main research endpoint
router.post("/", async (req, res) => {
  try {
    const { query, filters } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Query is required"
      });
    }

    console.log('Processing research request:', { query, filters });

    // Get relevant documents based on filters
    let conditions = [];
    
    if (filters?.jurisdiction && filters.jurisdiction !== 'all') {
      conditions.push(eq(legalDocuments.jurisdiction, filters.jurisdiction));
    }
    
    if (filters?.legalTopic && filters.legalTopic !== 'all') {
      conditions.push(eq(legalDocuments.legalTopic, filters.legalTopic));
    }

    const relevantDocs = conditions.length > 0
      ? await db.select().from(legalDocuments).where(and(...conditions)).limit(5)
      : await db.select().from(legalDocuments).limit(5);

    // Generate research using AI
    const research = await generateDeepResearch(query, {
      ...filters,
      relevantDocs
    });

    // Store the research results
    if (req.user?.id) {
      await db.insert(legalResearchReports).values({
        userId: req.user.id,
        query,
        jurisdiction: filters?.jurisdiction || 'all',
        legalTopic: filters?.legalTopic || 'all',
        results: research,
        dateRange: filters?.dateRange || null
      });
    }

    return res.json({
      success: true,
      ...research
    });

  } catch (error) {
    console.error("Research error:", error);
    return res.status(500).json({
      success: false,
      error: "Research failed",
      details: error instanceof Error ? error.message : 'Unknown error'
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