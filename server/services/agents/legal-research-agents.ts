import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { db } from "../../db";
import { legalDocuments, citationNetwork } from "@shared/schema/legal-research";
import { createEmbedding, searchSimilarDocuments } from "../embedding-service";
import { eq, inArray, sql, or, ilike, and } from "drizzle-orm";

// Initialize AI model - Gemini for query analysis and insight generation
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Validation schemas for agent outputs
const QueryAnalysisSchema = z.object({
  legalIssues: z.array(z.string()),
  keyTerms: z.array(z.string()),
  jurisdictionHints: z.array(z.string()),
  queryType: z.enum(["natural", "boolean", "citation"]),
  suggestedSearchTerms: z.array(z.string()),
  query: z.string()
});

const CitationAnalysisSchema = z.object({
  totalCitations: z.number(),
  positiveTreatments: z.number(),
  negativeTreatments: z.number(),
  keyPrecedents: z.array(z.object({
    documentId: z.number(),
    title: z.string(),
    citationCount: z.number(),
    treatment: z.string()
  })),
  citationNetwork: z.array(z.object({
    from: z.number(),
    to: z.number(),
    treatment: z.string()
  }))
});

const InsightsSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  legalPrinciples: z.array(z.string()),
  recommendations: z.array(z.string()),
  riskAssessment: z.object({
    level: z.enum(["low", "medium", "high"]),
    factors: z.array(z.string())
  }),
  relevantStatutes: z.array(z.string()),
  actionableSteps: z.array(z.string())
});

export type QueryAnalysis = z.infer<typeof QueryAnalysisSchema>;
export type CitationAnalysisResult = z.infer<typeof CitationAnalysisSchema>;
export type InsightsResult = z.infer<typeof InsightsSchema>;

// Agent System Orchestrator
export class LegalResearchAgentSystem {
  private queryAnalyzer: QueryAnalysisAgent;
  private documentRetriever: DocumentRetrievalAgent;
  private citationAnalyzer: CitationAnalysisAgent;
  private insightGenerator: InsightGenerationAgent;

  constructor() {
    this.queryAnalyzer = new QueryAnalysisAgent();
    this.documentRetriever = new DocumentRetrievalAgent();
    this.citationAnalyzer = new CitationAnalysisAgent();
    this.insightGenerator = new InsightGenerationAgent();
  }

  async processQuery(query: string, filters: {
    jurisdiction?: string;
    documentType?: string;
    dateRange?: { start?: Date; end?: Date };
    court?: string;
  } = {}) {
    try {
      // 1. Analyze query to understand intent and extract key terms
      console.log("Step 1: Analyzing query...");
      const queryAnalysis = await this.queryAnalyzer.analyze(query);

      // 2. Retrieve relevant documents using vector search and filters
      console.log("Step 2: Retrieving documents...");
      const relevantDocs = await this.documentRetriever.retrieve(queryAnalysis, filters);

      // 3. Analyze citations between retrieved documents
      console.log("Step 3: Analyzing citations...");
      const citationAnalysis = await this.citationAnalyzer.analyze(relevantDocs);

      // 4. Generate insights and recommendations
      console.log("Step 4: Generating insights...");
      const insights = await this.insightGenerator.generate(
        query,
        relevantDocs,
        citationAnalysis
      );

      return {
        queryAnalysis,
        documents: relevantDocs,
        citationAnalysis,
        insights,
        metadata: {
          totalDocuments: relevantDocs.length,
          processingTimestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      console.error("Error in legal research agent system:", error);
      throw new Error(`Legal research processing failed: ${error.message}`);
    }
  }
}

// Query Analysis Agent - Analyzes and parses legal research queries
class QueryAnalysisAgent {
  async analyze(query: string): Promise<QueryAnalysis> {
    try {
      // Check if Gemini API key is available
      if (!process.env.GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY not set, using fallback query analysis");
        return this.fallbackAnalysis(query);
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      const prompt = `
        You are a legal research expert. Analyze this legal research query and extract key components.

        Query: "${query}"

        Provide your analysis as a valid JSON object with EXACTLY these fields:
        {
          "legalIssues": ["array of identified legal issues"],
          "keyTerms": ["array of important legal terms"],
          "jurisdictionHints": ["array of jurisdictions that might be relevant"],
          "queryType": "natural" or "boolean" or "citation",
          "suggestedSearchTerms": ["array of additional search terms to expand the search"],
          "query": "the original query cleaned up"
        }

        Respond ONLY with the JSON object, no additional text.
      `;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Parse the JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("Failed to parse Gemini response, using fallback");
        return this.fallbackAnalysis(query);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return QueryAnalysisSchema.parse(parsed);
    } catch (error: any) {
      console.error("Query analysis error:", error);
      return this.fallbackAnalysis(query);
    }
  }

  private fallbackAnalysis(query: string): QueryAnalysis {
    // Basic keyword extraction as fallback
    const words = query.toLowerCase().split(/\s+/);
    const legalTerms = words.filter(w =>
      ["contract", "liability", "damages", "negligence", "breach", "tort",
       "statute", "regulation", "constitutional", "civil", "criminal",
       "plaintiff", "defendant", "appeal", "judgment", "precedent"].includes(w)
    );

    return {
      legalIssues: [query],
      keyTerms: legalTerms.length > 0 ? legalTerms : words.slice(0, 5),
      jurisdictionHints: [],
      queryType: "natural",
      suggestedSearchTerms: words.slice(0, 3),
      query: query
    };
  }
}

// Document Retrieval Agent - Retrieves relevant legal documents
class DocumentRetrievalAgent {
  async retrieve(queryAnalysis: QueryAnalysis, filters: {
    jurisdiction?: string;
    documentType?: string;
    dateRange?: { start?: Date; end?: Date };
    court?: string;
  }): Promise<any[]> {
    try {
      // First, try vector similarity search
      let vectorResults: string[] = [];
      try {
        const searchResults = await searchSimilarDocuments(queryAnalysis.query, 20);
        vectorResults = searchResults.ids;
      } catch (error) {
        console.warn("Vector search unavailable, using keyword search only");
      }

      // Build the where conditions for the query
      const conditions: any[] = [];

      // Add jurisdiction filter
      if (filters.jurisdiction && filters.jurisdiction !== 'All') {
        conditions.push(ilike(legalDocuments.jurisdiction, `%${filters.jurisdiction}%`));
      }

      // Add document type filter
      if (filters.documentType && filters.documentType !== 'All') {
        conditions.push(eq(legalDocuments.documentType, filters.documentType));
      }

      // Add court filter
      if (filters.court) {
        conditions.push(ilike(legalDocuments.court, `%${filters.court}%`));
      }

      // Add date range filter
      if (filters.dateRange?.start) {
        conditions.push(sql`${legalDocuments.dateDecided} >= ${filters.dateRange.start}`);
      }
      if (filters.dateRange?.end) {
        conditions.push(sql`${legalDocuments.dateDecided} <= ${filters.dateRange.end}`);
      }

      // Add keyword search conditions based on query analysis
      const keywordConditions = queryAnalysis.keyTerms.map(term =>
        or(
          ilike(legalDocuments.title, `%${term}%`),
          ilike(legalDocuments.content, `%${term}%`),
          ilike(legalDocuments.holdingSummary, `%${term}%`)
        )
      );

      if (keywordConditions.length > 0) {
        conditions.push(or(...keywordConditions));
      }

      // Execute the database query
      let documents;
      if (conditions.length > 0) {
        documents = await db
          .select()
          .from(legalDocuments)
          .where(and(...conditions))
          .limit(50);
      } else {
        // If no filters, get recent documents
        documents = await db
          .select()
          .from(legalDocuments)
          .limit(50);
      }

      // If we have vector results, prioritize those documents
      if (vectorResults.length > 0) {
        const vectorIds = vectorResults.map(id => parseInt(id)).filter(id => !isNaN(id));
        const vectorDocs = documents.filter(doc => vectorIds.includes(doc.id));
        const otherDocs = documents.filter(doc => !vectorIds.includes(doc.id));
        documents = [...vectorDocs, ...otherDocs];
      }

      console.log(`Retrieved ${documents.length} documents`);
      return documents;
    } catch (error: any) {
      console.error("Document retrieval error:", error);
      // Return empty array on error to allow processing to continue
      return [];
    }
  }
}

// Citation Analysis Agent - Analyzes citation relationships
class CitationAnalysisAgent {
  async analyze(documents: any[]): Promise<CitationAnalysisResult> {
    if (documents.length === 0) {
      return {
        totalCitations: 0,
        positiveTreatments: 0,
        negativeTreatments: 0,
        keyPrecedents: [],
        citationNetwork: []
      };
    }

    try {
      const documentIds = documents.map(doc => doc.id);

      // Query citation network for these documents
      const citations = await db
        .select()
        .from(citationNetwork)
        .where(
          or(
            inArray(citationNetwork.citingDocumentId, documentIds),
            inArray(citationNetwork.citedDocumentId, documentIds)
          )
        );

      // Calculate citation statistics
      const positiveTreatments = citations.filter(c =>
        c.treatment === "POSITIVE" || c.treatment === "FOLLOWED"
      ).length;

      const negativeTreatments = citations.filter(c =>
        c.treatment === "NEGATIVE" || c.treatment === "OVERRULED" ||
        c.treatment === "DISTINGUISHED" || c.treatment === "QUESTIONED"
      ).length;

      // Find key precedents (most cited documents)
      const citationCounts = new Map<number, number>();
      citations.forEach(c => {
        const count = citationCounts.get(c.citedDocumentId) || 0;
        citationCounts.set(c.citedDocumentId, count + 1);
      });

      const keyPrecedents = Array.from(citationCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([docId, count]) => {
          const doc = documents.find(d => d.id === docId);
          const lastCitation = citations.find(c => c.citedDocumentId === docId);
          return {
            documentId: docId,
            title: doc?.title || `Document ${docId}`,
            citationCount: count,
            treatment: lastCitation?.treatment || "NEUTRAL"
          };
        });

      // Build citation network edges
      const citationNetworkEdges = citations.map(c => ({
        from: c.citingDocumentId,
        to: c.citedDocumentId,
        treatment: c.treatment || "NEUTRAL"
      }));

      return {
        totalCitations: citations.length,
        positiveTreatments,
        negativeTreatments,
        keyPrecedents,
        citationNetwork: citationNetworkEdges
      };
    } catch (error: any) {
      console.error("Citation analysis error:", error);
      return {
        totalCitations: 0,
        positiveTreatments: 0,
        negativeTreatments: 0,
        keyPrecedents: [],
        citationNetwork: []
      };
    }
  }
}

// Insight Generation Agent - Generates legal insights and recommendations
class InsightGenerationAgent {
  async generate(
    query: string,
    documents: any[],
    citationAnalysis: CitationAnalysisResult
  ): Promise<InsightsResult> {
    try {
      // Check if Gemini API key is available
      if (!process.env.GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY not set, using fallback insights");
        return this.fallbackInsights(query, documents);
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      // Prepare document summaries for the prompt
      const documentSummaries = documents.slice(0, 10).map(doc => ({
        title: doc.title,
        jurisdiction: doc.jurisdiction,
        summary: doc.holdingSummary || doc.content?.substring(0, 500),
        citation: doc.citation
      }));

      const prompt = `
        You are an expert legal research analyst. Based on the following legal research query and retrieved documents, provide comprehensive insights.

        QUERY: "${query}"

        RETRIEVED DOCUMENTS:
        ${JSON.stringify(documentSummaries, null, 2)}

        CITATION ANALYSIS:
        - Total citations found: ${citationAnalysis.totalCitations}
        - Positive treatments: ${citationAnalysis.positiveTreatments}
        - Negative treatments: ${citationAnalysis.negativeTreatments}
        - Key precedents: ${citationAnalysis.keyPrecedents.map(p => p.title).join(", ")}

        Provide your analysis as a valid JSON object with EXACTLY these fields:
        {
          "summary": "comprehensive summary of findings",
          "keyFindings": ["array of key findings from the research"],
          "legalPrinciples": ["array of relevant legal principles identified"],
          "recommendations": ["array of recommendations for the legal issue"],
          "riskAssessment": {
            "level": "low" or "medium" or "high",
            "factors": ["array of risk factors to consider"]
          },
          "relevantStatutes": ["array of relevant statutes or regulations"],
          "actionableSteps": ["array of next steps to take"]
        }

        Respond ONLY with the JSON object, no additional text.
      `;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Parse the JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("Failed to parse Gemini response, using fallback");
        return this.fallbackInsights(query, documents);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return InsightsSchema.parse(parsed);
    } catch (error: any) {
      console.error("Insight generation error:", error);
      return this.fallbackInsights(query, documents);
    }
  }

  private fallbackInsights(query: string, documents: any[]): InsightsResult {
    return {
      summary: `Research completed for: "${query}". Found ${documents.length} relevant documents.`,
      keyFindings: documents.slice(0, 3).map(doc =>
        `${doc.title}: ${doc.holdingSummary || "See document for details"}`
      ),
      legalPrinciples: ["Review retrieved documents for applicable legal principles"],
      recommendations: [
        "Review the retrieved documents in detail",
        "Consult with a qualified attorney for specific legal advice",
        "Consider the jurisdiction-specific implications"
      ],
      riskAssessment: {
        level: "medium",
        factors: [
          "Legal research requires professional interpretation",
          "Jurisdiction-specific rules may apply"
        ]
      },
      relevantStatutes: [],
      actionableSteps: [
        "Review top-ranked documents",
        "Analyze citation network for precedent strength",
        "Identify controlling authority in relevant jurisdiction"
      ]
    };
  }
}

// Export singleton instance
export const legalResearchAgentSystem = new LegalResearchAgentSystem();
