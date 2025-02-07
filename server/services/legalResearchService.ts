import { Anthropic } from '@anthropic-ai/sdk';
import { ChromaClient, Collection } from 'chromadb';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { legalDocuments, legalCitations } from '@shared/schema';
import type { LegalDocument, Citation } from '@shared/schema';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize ChromaDB client for vector storage
const chroma = new ChromaClient();
let vectorStore: Collection;

interface SearchResult {
  document: LegalDocument;
  similarity: number;
  citations: Citation[];
}

interface ResearchResponse {
  summary: string;
  relevantCases: SearchResult[];
  timeline?: TimelineEvent[];
  citationMap?: CitationNode[];
}

interface TimelineEvent {
  date: string;
  event: string;
  significance: string;
}

interface CitationNode {
  id: string;
  title: string;
  year: number;
  citations: string[];
}

export class LegalResearchService {
  private static instance: LegalResearchService;

  private constructor() {
    this.initializeVectorStore();
  }

  static getInstance(): LegalResearchService {
    if (!LegalResearchService.instance) {
      LegalResearchService.instance = new LegalResearchService();
    }
    return LegalResearchService.instance;
  }

  private async initializeVectorStore() {
    try {
      // Create or get the collection for legal documents
      vectorStore = await chroma.getOrCreateCollection('legal_documents');
      console.log('Vector store initialized successfully');
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      throw error;
    }
  }

  async addDocument(document: LegalDocument): Promise<void> {
    try {
      // Generate embedding for the document
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Extract the key legal principles and arguments from this document:\n\n${document.content}`
        }]
      });

      const embedding = await this.generateEmbedding(document.content);

      // Store in vector database
      await vectorStore.add({
        ids: [document.id.toString()],
        embeddings: [embedding],
        metadatas: [{
          title: document.title,
          type: document.documentType,
          date: document.date,
          jurisdiction: document.jurisdiction
        }]
      });

      // Store in relational database
      await db.insert(legalDocuments).values(document);

    } catch (error) {
      console.error('Failed to add document:', error);
      throw error;
    }
  }

  async searchSimilarCases(query: string): Promise<SearchResult[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);

      // Search vector store
      const results = await vectorStore.query({
        queryEmbeddings: [queryEmbedding],
        nResults: 5
      });

      // Fetch full documents and citations
      const searchResults: SearchResult[] = await Promise.all(
        results.ids[0].map(async (id, index) => {
          const [document] = await db
            .select()
            .from(legalDocuments)
            .where(eq(legalDocuments.id, parseInt(id)));

          const citations = await db
            .select()
            .from(legalCitations)
            .where(eq(legalCitations.documentId, parseInt(id)));

          return {
            document,
            similarity: results.distances[0][index],
            citations
          };
        })
      );

      return searchResults;

    } catch (error) {
      console.error('Failed to search similar cases:', error);
      throw error;
    }
  }

  async analyzeQuery(query: string): Promise<ResearchResponse> {
    try {
      // Get similar cases
      const similarCases = await this.searchSimilarCases(query);

      // Generate comprehensive analysis using Claude
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        temperature: 0.2,
        messages: [{
          role: "user",
          content: `Analyze this legal query and similar cases to provide a comprehensive response. Include a summary, timeline of key events, and citation relationships.

Query: ${query}

Similar Cases:
${similarCases.map(result => `
Title: ${result.document.title}
Content: ${result.document.content}
Citations: ${result.citations.map(c => c.citedCase).join(', ')}
`).join('\n')}

Provide the analysis in JSON format with the following structure:
{
  "summary": "Concise analysis of the query and relevant cases",
  "timeline": [{"date": "YYYY-MM-DD", "event": "Description", "significance": "Legal importance"}],
  "citationMap": [{"id": "case_id", "title": "Case name", "year": year, "citations": ["cited_case_ids"]}]
}`
        }],
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.content[0].text);

      return {
        summary: analysis.summary,
        relevantCases: similarCases,
        timeline: analysis.timeline,
        citationMap: analysis.citationMap
      };

    } catch (error) {
      console.error('Failed to analyze query:', error);
      throw error;
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Generate a dense vector embedding for this legal text that captures its key legal concepts, principles, and arguments. Return only the numerical vector values as a JSON array:\n\n${text}`
        }],
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.content[0].text).embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }
}

export const legalResearchService = LegalResearchService.getInstance();
