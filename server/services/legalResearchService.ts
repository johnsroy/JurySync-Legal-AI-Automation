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

export class LegalResearchService {
  private static instance: LegalResearchService;
  private vectorStore: InMemoryVectorStore;
  private isChromaInitialized: boolean = false;

  private constructor() {
    // Always start with in-memory store
    this.vectorStore = new InMemoryVectorStore();
    console.log('Initialized with in-memory vector store');

    // Try to initialize ChromaDB in the background
    this.initializeChromaDB().catch(error => {
      console.error('ChromaDB initialization failed, continuing with in-memory storage:', error);
    });
  }

  static getInstance(): LegalResearchService {
    if (!LegalResearchService.instance) {
      LegalResearchService.instance = new LegalResearchService();
    }
    return LegalResearchService.instance;
  }

  private async initializeChromaDB() {
    try {
      console.log('Attempting to initialize ChromaDB...');
      const client = new ChromaClient();

      // Test connection first
      await client.heartbeat().catch(() => {
        throw new Error('ChromaDB is not responding');
      });

      const collection = await client.getOrCreateCollection({
        name: 'legal_documents',
        metadata: {
          description: "Vector embeddings for legal documents",
          dataType: "legal_text"
        }
      });

      // Only switch to ChromaDB if everything worked
      this.vectorStore = collection;
      this.isChromaInitialized = true;
      console.log('Successfully switched to ChromaDB');
    } catch (error) {
      console.warn('ChromaDB initialization failed, will continue using in-memory store:', error);
      // Keep using the in-memory store
    }
  }

  async addDocument(document: LegalDocument): Promise<void> {
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
      // First try using Anthropic API
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

      return JSON.parse(content.text).embedding;
    } catch (error) {
      console.error('Failed to generate embedding using Anthropic API, using fallback method:', error);

      // Fallback: Generate a simple tf-idf like representation
      const words = text.toLowerCase().split(/\W+/);
      const uniqueWords = Array.from(new Set(words));
      const vector = new Array(1024).fill(0);

      uniqueWords.forEach((word, index) => {
        const hashCode = this.simpleHash(word);
        const vectorIndex = hashCode % 1024;
        const frequency = words.filter(w => w === word).length;
        vector[vectorIndex] += frequency;
      });

      // Normalize the vector
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      return vector.map(val => val / (magnitude || 1));
    }
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

}

export const legalResearchService = LegalResearchService.getInstance();

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