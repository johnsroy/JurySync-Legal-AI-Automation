import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { db } from "../../db";
import { legalDocuments, citationNetwork, type LegalDocument, type CitationNetwork } from "@shared/schema/legal-research";
import { createEmbedding, cosineSimilarity } from "../embedding-service";
import { eq, and, or, ilike, inArray, sql } from "drizzle-orm";

// Initialize AI models
const openai = new OpenAI();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Type definitions
interface QueryAnalysis {
  query: string;
  legalIssues: string[];
  keyTerms: string[];
  jurisdictionHints: string[];
  queryType: 'natural' | 'boolean';
  suggestedSearchTerms: string[];
}

interface SearchFilters {
  jurisdiction?: string;
  documentType?: string;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  court?: string;
}

interface CitationAnalysisResult {
  totalCitations: number;
  positiveCitations: number;
  negativeCitations: number;
  keyPrecedents: string[];
  citationNetwork: Array<{
    sourceId: number;
    targetId: number;
    treatment: string;
    context: string;
  }>;
}

interface LegalInsights {
  summary: string;
  keyHoldings: string[];
  blackLetterLaw: string[];
  relevantPrecedents: string[];
  recommendedActions: string[];
  riskFactors: string[];
  confidence: number;
}

// Agent System
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

  async processQuery(query: string, filters: SearchFilters) {
    try {
      // 1. Analyze query
      const queryAnalysis = await this.queryAnalyzer.analyze(query);

      // 2. Retrieve relevant documents
      const relevantDocs = await this.documentRetriever.retrieve(queryAnalysis, filters);

      // 3. Analyze citations
      const citationAnalysis = await this.citationAnalyzer.analyze(relevantDocs);

      // 4. Generate insights
      const insights = await this.insightGenerator.generate(
        query,
        relevantDocs,
        citationAnalysis
      );

      return {
        queryAnalysis,
        documents: relevantDocs,
        citationAnalysis,
        insights
      };
    } catch (error) {
      console.error("Error processing legal research query:", error);
      throw new Error(`Legal research query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Individual Agents
class QueryAnalysisAgent {
  async analyze(query: string): Promise<QueryAnalysis> {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      const prompt = `
        Analyze this legal research query and extract key components:
        Query: "${query}"

        Provide analysis in JSON format with the following structure:
        {
          "query": "the original query",
          "legalIssues": ["array of identified legal issues"],
          "keyTerms": ["array of key search terms"],
          "jurisdictionHints": ["any jurisdictions mentioned or implied"],
          "queryType": "natural or boolean",
          "suggestedSearchTerms": ["additional search terms to try"]
        }

        Return ONLY valid JSON, no markdown formatting.
      `;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Clean up response if it contains markdown code blocks
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      return JSON.parse(cleanedResponse);
    } catch (error) {
      console.error("Query analysis failed:", error);
      // Return a basic analysis if AI fails
      return {
        query,
        legalIssues: [],
        keyTerms: query.split(' ').filter(term => term.length > 3),
        jurisdictionHints: [],
        queryType: 'natural',
        suggestedSearchTerms: []
      };
    }
  }
}

class DocumentRetrievalAgent {
  async retrieve(queryAnalysis: QueryAnalysis, filters: SearchFilters): Promise<LegalDocument[]> {
    try {
      // Get all search terms (original + suggested)
      const searchTerms = [
        ...queryAnalysis.keyTerms,
        ...queryAnalysis.suggestedSearchTerms
      ];

      // Build search conditions
      const searchConditions: any[] = [];

      // Add text search for each key term
      for (const term of searchTerms) {
        searchConditions.push(ilike(legalDocuments.title, `%${term}%`));
        searchConditions.push(ilike(legalDocuments.content, `%${term}%`));
        searchConditions.push(ilike(legalDocuments.holdingSummary, `%${term}%`));
      }

      // Build filter conditions
      const filterConditions: any[] = [];

      if (filters.jurisdiction) {
        filterConditions.push(eq(legalDocuments.jurisdiction, filters.jurisdiction));
      }

      if (filters.documentType) {
        filterConditions.push(eq(legalDocuments.documentType, filters.documentType));
      }

      if (filters.court) {
        filterConditions.push(eq(legalDocuments.court, filters.court));
      }

      // Combine conditions
      let whereClause;
      if (searchConditions.length > 0 && filterConditions.length > 0) {
        whereClause = and(
          or(...searchConditions),
          and(...filterConditions)
        );
      } else if (searchConditions.length > 0) {
        whereClause = or(...searchConditions);
      } else if (filterConditions.length > 0) {
        whereClause = and(...filterConditions);
      }

      // Execute query
      let documents: LegalDocument[];
      if (whereClause) {
        documents = await db
          .select()
          .from(legalDocuments)
          .where(whereClause)
          .limit(50);
      } else {
        documents = await db
          .select()
          .from(legalDocuments)
          .limit(50);
      }

      // If we have documents and embedding capability, rank by relevance
      if (documents.length > 0 && queryAnalysis.query) {
        try {
          const queryEmbedding = await createEmbedding(queryAnalysis.query);

          // Calculate similarity scores for documents with embeddings
          const documentsWithScores = documents.map(doc => {
            let score = 0;
            if (doc.vectorEmbedding && Array.isArray(doc.vectorEmbedding)) {
              score = cosineSimilarity(queryEmbedding, doc.vectorEmbedding as number[]);
            }
            return { ...doc, relevanceScore: score };
          });

          // Sort by relevance score
          documentsWithScores.sort((a, b) => b.relevanceScore - a.relevanceScore);

          // Return top results
          return documentsWithScores.slice(0, 20);
        } catch (embeddingError) {
          console.error("Embedding search failed, returning text search results:", embeddingError);
          return documents.slice(0, 20);
        }
      }

      return documents;
    } catch (error) {
      console.error("Document retrieval failed:", error);
      return [];
    }
  }
}

class CitationAnalysisAgent {
  async analyze(documents: LegalDocument[]): Promise<CitationAnalysisResult> {
    try {
      if (documents.length === 0) {
        return {
          totalCitations: 0,
          positiveCitations: 0,
          negativeCitations: 0,
          keyPrecedents: [],
          citationNetwork: []
        };
      }

      // Get document IDs
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

      return this.processCitations(citations, documents);
    } catch (error) {
      console.error("Citation analysis failed:", error);
      return {
        totalCitations: 0,
        positiveCitations: 0,
        negativeCitations: 0,
        keyPrecedents: [],
        citationNetwork: []
      };
    }
  }

  private processCitations(citations: CitationNetwork[], documents: LegalDocument[]): CitationAnalysisResult {
    const positiveTreatments = ['POSITIVE', 'FOLLOWED', 'AFFIRMED'];
    const negativeTreatments = ['NEGATIVE', 'OVERRULED', 'QUESTIONED', 'CRITICIZED', 'DISTINGUISHED'];

    let positiveCitations = 0;
    let negativeCitations = 0;
    const precedentCounts: Record<number, number> = {};

    for (const citation of citations) {
      // Count positive/negative treatments
      if (citation.treatment && positiveTreatments.includes(citation.treatment.toUpperCase())) {
        positiveCitations++;
      } else if (citation.treatment && negativeTreatments.includes(citation.treatment.toUpperCase())) {
        negativeCitations++;
      }

      // Track which documents are cited most
      if (citation.citedDocumentId) {
        precedentCounts[citation.citedDocumentId] = (precedentCounts[citation.citedDocumentId] || 0) + 1;
      }
    }

    // Find key precedents (most cited documents)
    const sortedPrecedents = Object.entries(precedentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => {
        const doc = documents.find(d => d.id === parseInt(id));
        return doc?.citation || doc?.title || `Document ${id}`;
      });

    return {
      totalCitations: citations.length,
      positiveCitations,
      negativeCitations,
      keyPrecedents: sortedPrecedents,
      citationNetwork: citations.map(c => ({
        sourceId: c.citingDocumentId,
        targetId: c.citedDocumentId,
        treatment: c.treatment || 'NEUTRAL',
        context: c.context || ''
      }))
    };
  }
}

class InsightGenerationAgent {
  async generate(query: string, documents: LegalDocument[], citationAnalysis: CitationAnalysisResult): Promise<LegalInsights> {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      // Prepare document summaries for the prompt
      const documentSummaries = documents.slice(0, 10).map(doc => ({
        title: doc.title,
        type: doc.documentType,
        jurisdiction: doc.jurisdiction,
        holding: doc.holdingSummary || '',
        blackLetter: doc.blackLetterLaw || ''
      }));

      const prompt = `
        You are a legal research assistant. Based on the following legal research query and documents, provide comprehensive insights.

        QUERY: "${query}"

        DOCUMENTS FOUND:
        ${JSON.stringify(documentSummaries, null, 2)}

        CITATION ANALYSIS:
        - Total citations: ${citationAnalysis.totalCitations}
        - Positive treatments: ${citationAnalysis.positiveCitations}
        - Negative treatments: ${citationAnalysis.negativeCitations}
        - Key precedents: ${citationAnalysis.keyPrecedents.join(', ')}

        Provide your analysis in the following JSON format:
        {
          "summary": "A comprehensive summary of the legal findings",
          "keyHoldings": ["Array of key holdings from the cases"],
          "blackLetterLaw": ["Array of established legal principles"],
          "relevantPrecedents": ["Array of the most relevant case citations"],
          "recommendedActions": ["Array of recommended next steps for legal research"],
          "riskFactors": ["Array of potential risks or considerations"],
          "confidence": 0.85
        }

        Return ONLY valid JSON, no markdown formatting.
      `;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Clean up response if it contains markdown code blocks
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      return JSON.parse(cleanedResponse);
    } catch (error) {
      console.error("Insight generation failed:", error);
      // Return basic insights if AI fails
      return {
        summary: `Found ${documents.length} relevant documents for your query: "${query}"`,
        keyHoldings: documents.slice(0, 5).map(d => d.holdingSummary || d.title).filter(Boolean),
        blackLetterLaw: documents.slice(0, 5).map(d => d.blackLetterLaw).filter(Boolean) as string[],
        relevantPrecedents: documents.slice(0, 5).map(d => d.citation || d.title),
        recommendedActions: [
          "Review the retrieved documents in detail",
          "Consider expanding your search with related terms",
          "Check citation network for additional precedents"
        ],
        riskFactors: citationAnalysis.negativeCitations > 0
          ? ["Some cases have been negatively treated - verify current validity"]
          : [],
        confidence: 0.5
      };
    }
  }
}

// Export singleton instance
export const legalResearchAgentSystem = new LegalResearchAgentSystem(); 