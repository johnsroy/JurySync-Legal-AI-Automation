import { Router } from "express";
import { db } from "../db";
import { legalResearchReports, legalDocuments } from "@shared/schema";
import { generateDeepResearch } from "../services/gemini-service";
import { z } from "zod";
import { desc, eq, and, gte, lte, ilike } from 'drizzle-orm';

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
        query: "What are the key requirements for filing a patent application?",
        jurisdiction: "United States",
        legalTopic: "Intellectual Property"
      },
      {
        id: 2,
        query: "Recent developments in data privacy regulations",
        jurisdiction: "European Union",
        legalTopic: "Privacy Law"
      },
      {
        id: 3,
        query: "Legal framework for smart contracts and blockchain",
        jurisdiction: "International",
        legalTopic: "Technology Law"
      }
    ];

    // Also fetch recent successful queries from the database
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
      recentQueries: recentQueries
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
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        error: "Authentication required" 
      });
    }

    const validatedData = researchRequestSchema.parse(req.body);
    console.log('Starting legal research:', validatedData);

    // First check our legal documents database for relevant documents
    let relevantDocs = await db.select()
      .from(legalDocuments)
      .where(
        and(
          validatedData.jurisdiction ? eq(legalDocuments.jurisdiction, validatedData.jurisdiction) : undefined,
          validatedData.legalTopic ? eq(legalDocuments.legalTopic, validatedData.legalTopic) : undefined,
          ilike(legalDocuments.content, `%${validatedData.query}%`)
        )
      )
      .limit(5);

    console.log('Found relevant documents:', relevantDocs.length);

    // Generate AI research incorporating relevant documents
    const researchResults = await generateDeepResearch(
      validatedData.query,
      {
        jurisdiction: validatedData.jurisdiction,
        legalTopic: validatedData.legalTopic,
        dateRange: validatedData.dateRange
      }
    );

    // Store results in database
    await db.insert(legalResearchReports).values({
      userId: req.user.id,
      query: validatedData.query,
      jurisdiction: validatedData.jurisdiction || 'All',
      legalTopic: validatedData.legalTopic || 'All',
      results: researchResults,
      dateRange: validatedData.dateRange || null,
      timestamp: new Date()
    });

    return res.json({
      success: true,
      data: {
        executiveSummary: researchResults.executiveSummary,
        findings: researchResults.findings,
        recommendations: researchResults.recommendations,
        relevantDocuments: relevantDocs.map(doc => ({
          title: doc.title,
          jurisdiction: doc.jurisdiction,
          date: doc.date,
          type: doc.documentType
        })),
        timestamp: new Date().toISOString(),
        filters: {
          jurisdiction: validatedData.jurisdiction,
          legalTopic: validatedData.legalTopic,
          dateRange: validatedData.dateRange
        }
      }
    });

  } catch (error) {
    console.error("Legal research error:", error);
    return res.status(500).json({ 
      success: false,
      error: "Research failed",
      details: error instanceof Error ? error.message : 'Unknown error occurred'
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

// Get available research for filters
router.get("/available", async (req, res) => {
  try {
    const { jurisdiction, legalTopic, startDate, endDate } = req.query;

    let conditions = [];

    if (jurisdiction && jurisdiction !== 'all') {
      conditions.push(eq(legalResearchReports.jurisdiction, jurisdiction as string));
    }

    if (legalTopic && legalTopic !== 'all') {
      conditions.push(eq(legalResearchReports.legalTopic, legalTopic as string));
    }

    if (startDate) {
      conditions.push(gte(legalResearchReports.timestamp, new Date(startDate as string)));
    }

    if (endDate) {
      conditions.push(lte(legalResearchReports.timestamp, new Date(endDate as string)));
    }

    // Get both research reports and relevant documents
    const [reports, documents] = await Promise.all([
      db.select()
        .from(legalResearchReports)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(legalResearchReports.timestamp))
        .limit(50),

      db.select()
        .from(legalDocuments)
        .where(
          and(
            jurisdiction !== 'all' ? eq(legalDocuments.jurisdiction, jurisdiction as string) : undefined,
            legalTopic !== 'all' ? eq(legalDocuments.legalTopic, legalTopic as string) : undefined
          )
        )
        .limit(50)
    ]);

    return res.json({
      success: true,
      data: {
        reports,
        documents: documents.map(doc => ({
          title: doc.title,
          jurisdiction: doc.jurisdiction,
          date: doc.date,
          type: doc.documentType,
          topic: doc.legalTopic
        }))
      }
    });

  } catch (error) {
    console.error("Error fetching available research:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch available research"
    });
  }
});

// Suggest questions endpoint
router.post("/suggest-questions", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { query, jurisdiction, legalTopic, dateRange } = req.body;

    if (!jurisdiction || !legalTopic) {
      return res.status(400).json({ error: "Missing required filters" });
    }

    // First check if we have cached suggestions
    const cachedSuggestions = await db.query.legalResearchReports.findFirst({
      where: (reports, { and, eq }) => and(
        eq(reports.jurisdiction, jurisdiction),
        eq(reports.legalTopic, legalTopic),
      ),
      orderBy: (reports, { desc }) => [desc(reports.timestamp)],
    });

    if (cachedSuggestions?.suggestions) {
      return res.json(cachedSuggestions.suggestions);
    }

    const dateContext = dateRange.start && dateRange.end
      ? `between ${new Date(dateRange.start).toLocaleDateString()} and ${new Date(dateRange.end).toLocaleDateString()}`
      : "with no specific date range";

    const prompt = `
      As a legal research expert, generate 5 relevant follow-up questions for research in ${jurisdiction} jurisdiction 
      focusing on ${legalTopic} ${dateContext}.

      Original query: "${query || 'No specific query provided'}"

      Consider:
      1. Relevant legal precedents in this jurisdiction
      2. Recent developments in ${legalTopic}
      3. Specific regulations and requirements
      4. Common legal challenges in this area
      5. Industry-specific considerations

      Format the response as a JSON array of strings, where each string is a detailed question.
      The questions should be specific, actionable, and help deepen the legal analysis.

      Example format:
      ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-0125-preview",
      messages: [
        {
          role: "system",
          content: "You are a legal research expert specializing in generating relevant jurisdiction-specific follow-up questions."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const response = JSON.parse(completion.choices[0].message.content);

    // Store suggestions in the knowledge base
    await db.insert(legalResearchReports).values({
      userId: req.user.id,
      jurisdiction,
      legalTopic,
      suggestions: response,
      timestamp: new Date(),
    });

    return res.json(response);

  } catch (error) {
    console.error("Error generating suggested questions:", error);
    return res.status(500).json({ 
      error: "Failed to generate suggestions",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Analyze endpoint
router.post("/analyze", async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    let text = '';
    const fileType = req.file.originalname.toLowerCase();

    if (fileType.endsWith('.pdf')) {
      try {
        // Load the PDF document
        const pdfDoc = await PDFDocument.load(req.file.buffer);
        const pages = pdfDoc.getPages();

        // Extract text from all pages
        text = (await Promise.all(
          pages.map(async (page) => {
            const textContent = await page.extractText();
            return textContent.replace(/\s+/g, ' ').trim();
          })
        )).join('\n');

      } catch (error) {
        console.error('PDF parsing error:', error);
        return res.status(400).json({ error: "Failed to parse PDF file" });
      }
    } else if (fileType.endsWith('.txt')) {
      text = req.file.buffer.toString('utf-8');
    } else {
      return res.status(400).json({ 
        error: "Unsupported file type. Please upload PDF or TXT files only." 
      });
    }

    // Clean the text
    text = text
      .replace(/<!DOCTYPE[^>]*>/g, '')
      .replace(/<\?xml[^>]*\?>/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return res.json({ text });
  } catch (error) {
    console.error("File analysis error:", error);
    return res.status(500).json({ error: "Failed to analyze file" });
  }
});

export default router;