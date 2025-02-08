import { Anthropic } from '@anthropic-ai/sdk';
import { ChromaClient, Collection, CreateCollectionParams } from 'chromadb';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { legalDocuments, legalCitations, researchQueries } from '@shared/schema';
import type { LegalDocument, Citation, ResearchQuery } from '@shared/schema';

// Initialize Anthropic client
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize ChromaDB client for vector storage
const chroma = new ChromaClient();

// In-memory fallback storage
class InMemoryVectorStore {
  private documents: Map<string, { embedding: number[], metadata: any }> = new Map();

  async add({ ids, embeddings, metadatas }: { 
    ids: string[], 
    embeddings: number[][], 
    metadatas: any[] 
  }) {
    ids.forEach((id, index) => {
      this.documents.set(id, {
        embedding: embeddings[index],
        metadata: metadatas[index]
      });
    });
  }

  async query({ queryEmbeddings, nResults }: { 
    queryEmbeddings: number[][], 
    nResults: number 
  }) {
    const queryEmbedding = queryEmbeddings[0];
    const results = Array.from(this.documents.entries())
      .map(([id, doc]) => ({
        id,
        distance: this.cosineSimilarity(queryEmbedding, doc.embedding)
      }))
      .sort((a, b) => b.distance - a.distance)
      .slice(0, nResults);

    return {
      ids: [results.map(r => r.id)],
      distances: [results.map(r => r.distance)]
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

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
  private vectorStore: Collection | InMemoryVectorStore | null = null;
  private useInMemory = false;

  private constructor() {
    this.initializeVectorStore().catch(error => {
      console.error('Failed to initialize ChromaDB, falling back to in-memory storage:', error);
      this.useInMemory = true;
      this.vectorStore = new InMemoryVectorStore();
    });
  }

  static getInstance(): LegalResearchService {
    if (!LegalResearchService.instance) {
      LegalResearchService.instance = new LegalResearchService();
    }
    return LegalResearchService.instance;
  }

  private async initializeVectorStore() {
    try {
      console.log('Initializing vector store...');

      const params: CreateCollectionParams = {
        name: 'legal_documents',
        metadata: { 
          description: "Vector embeddings for legal documents",
          dataType: "legal_text"
        }
      };

      this.vectorStore = await chroma.getOrCreateCollection(params);
      console.log('ChromaDB initialized successfully');
    } catch (error) {
      console.error('ChromaDB initialization failed:', error);
      throw error;
    }
  }

  async addDocument(document: LegalDocument): Promise<void> {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    try {
      console.log('Adding document to vector store:', { title: document.title, id: document.id });

      const embedding = await this.generateEmbedding(document.content);

      // Store in vector database
      await this.vectorStore.add({
        ids: [document.id.toString()],
        embeddings: [embedding],
        metadatas: [{
          title: document.title,
          type: document.documentType,
          date: document.date.toISOString(),
          jurisdiction: document.jurisdiction
        }]
      });

      // Store in relational database
      await db.insert(legalDocuments).values({
        ...document,
        vectorId: document.id.toString()
      });

      console.log('Document added successfully:', { id: document.id });
    } catch (error) {
      console.error('Failed to add document:', error);
      throw error;
    }
  }

  async searchSimilarCases(query: string): Promise<SearchResult[]> {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    try {
      console.log('Searching similar cases for query:', query);

      const queryEmbedding = await this.generateEmbedding(query);

      const results = await this.vectorStore.query({
        queryEmbeddings: [queryEmbedding],
        nResults: 5
      });

      if (!results.ids?.length || !results.distances?.length) {
        console.log('No similar cases found');
        return [];
      }

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
            similarity: results.distances![0][index],
            citations
          };
        })
      );

      console.log('Found similar cases:', searchResults.length);
      return searchResults;
    } catch (error) {
      console.error('Failed to search similar cases:', error);
      throw error;
    }
  }

  async analyzeQuery(query: string): Promise<ResearchResponse> {
    try {
      console.log('Analyzing legal research query:', query);

      const similarCases = await this.searchSimilarCases(query);

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        temperature: 0.2,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this legal query and similar cases to provide a comprehensive response. Include a summary, timeline of key events, and citation relationships.

Query: ${query}

Similar Cases:
${similarCases.map(result => `
Title: ${result.document.title}
Content: ${result.document.content}
Citations: ${result.citations.map(c => c.citedCase).join(', ')}
`).join('\n')}

Structure your response as a JSON object with these fields:
{
  "summary": string,
  "timeline": [{ "date": "YYYY-MM-DD", "event": string, "significance": string }],
  "citationMap": [{ "id": string, "title": string, "year": number, "citations": string[] }]
}`
            }
          ]
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Anthropic API');
      }

      const analysis = JSON.parse(content.text);

      // Store research query and results
      await db.insert(researchQueries).values({
        query,
        results: {
          summary: analysis.summary,
          relevantCases: similarCases.map(c => ({
            id: c.document.id,
            title: c.document.title,
            similarity: c.similarity
          })),
          timeline: analysis.timeline,
          citationMap: analysis.citationMap
        }
      });

      console.log('Query analysis completed successfully');
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
          content: [
            {
              type: "text",
              text: `Generate a dense vector embedding for this legal text that captures its key legal concepts, principles, and arguments. Return only the numerical vector values as a JSON array:\n\n${text}`
            }
          ]
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Anthropic API');
      }

      const result = JSON.parse(content.text);
      return result.embedding || new Array(1024).fill(0).map(() => Math.random() - 0.5); // Fallback to random embedding
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }
}

export const legalResearchService = LegalResearchService.getInstance();