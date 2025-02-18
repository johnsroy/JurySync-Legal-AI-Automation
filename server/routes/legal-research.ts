import { Router, Request, Response, NextFunction } from 'express';
import { db } from "../db";
import { legalResearchReports, legalDocuments } from "@shared/schema";
import { generateDeepResearch } from "../services/gemini-service";
import { z } from "zod";
import { desc, eq, and, gte, lte } from 'drizzle-orm';

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

// Error handling middleware - must be first
const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Legal Research Error:', {
    error: err,
    stack: err.stack,
    message: err.message
  });

  // Ensure JSON response
  res.setHeader('Content-Type', 'application/json');

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: "Invalid request data",
      details: err.errors
    });
  }

  // Handle JSON parsing errors
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: "Invalid JSON",
      details: err.message
    });
  }

  res.status(500).json({
    success: false,
    error: err.message || "Research failed",
    details: err.stack
  });
};

router.use(errorHandler); // Moved this line

// Get example queries for new users
router.get("/examples", async (req: Request, res: Response) => {
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
router.get("/available", async (req: Request, res: Response) => {
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
router.post("/", async (req: Request, res: Response) => {
  try {
    console.log("Received research request:", req.body);

    // Ensure JSON response
    res.setHeader('Content-Type', 'application/json');

    const validatedData = researchRequestSchema.parse(req.body);

    // Build query conditions
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

    // Generate research using Gemini
    const researchResults = await generateDeepResearch(validatedData.query, {
      jurisdiction: validatedData.jurisdiction,
      legalTopic: validatedData.legalTopic,
      dateRange: validatedData.dateRange,
      relevantDocs: relevantDocs.map(doc => ({
        title: doc.title,
        jurisdiction: doc.jurisdiction,
        legalTopic: doc.legalTopic,
        content: doc.content,
        citation: doc.metadata?.citation
      }))
    });

    // Store results if user is authenticated
    if (req.user?.id) {
      await db.insert(legalResearchReports).values({
        userId: req.user.id,
        query: validatedData.query,
        jurisdiction: validatedData.jurisdiction || 'all',
        legalTopic: validatedData.legalTopic || 'all',
        results: researchResults,
        dateRange: validatedData.dateRange || null
      });
    }

    return res.json({
      success: true,
      ...researchResults,
      relevantDocuments: relevantDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        jurisdiction: doc.jurisdiction,
        topic: doc.legalTopic,
        date: doc.date,
        type: doc.documentType,
        citation: doc.metadata?.citation,
        content: doc.content.substring(0, 300) + '...'
      }))
    });

  } catch (error: any) {
    console.error("Legal Research Error:", {
      error,
      stack: error.stack,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: "Research failed",
      details: error.message
    });
  }
});

// Get available research filters
router.get("/filters", async (req: Request, res: Response) => {
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