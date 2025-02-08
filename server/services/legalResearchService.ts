import { Anthropic } from '@anthropic-ai/sdk';
import { ChromaClient, Collection } from 'chromadb';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { legalDocuments, legalCitations, researchQueries } from '@shared/schema';
import type { LegalDocument, Citation, ResearchQuery } from '@shared/schema';
import NodeCache from 'node-cache';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Cache configuration
const vectorCache = new NodeCache({
  stdTTL: 3600, // 1 hour default TTL
  checkperiod: 600, // Check for expired entries every 10 minutes
  useClones: false
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
      // Also cache the document
      vectorCache.set(`doc_${id}`, {
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
  private chromaClient?: ChromaClient;
  private chromaCollection?: Collection;
  private initializationPromise?: Promise<void>;

  private constructor() {
    // Start with in-memory store
    this.vectorStore = new InMemoryVectorStore();
    console.log('Legal Research Service initialized with in-memory store');
  }

  static getInstance(): LegalResearchService {
    if (!LegalResearchService.instance) {
      LegalResearchService.instance = new LegalResearchService();
    }
    return LegalResearchService.instance;
  }

  private async initializeChromaDB(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = (async () => {
        try {
          console.log('Initializing ChromaDB in background...');
          this.chromaClient = new ChromaClient();

          // Test connection
          await this.chromaClient.heartbeat().catch(() => {
            throw new Error('ChromaDB is not responding');
          });

          this.chromaCollection = await this.chromaClient.getOrCreateCollection({
            name: 'legal_documents',
            metadata: {
              description: "Vector embeddings for legal documents",
              dataType: "legal_text"
            }
          });

          console.log('ChromaDB initialized successfully');
        } catch (error) {
          console.warn('ChromaDB initialization failed, continuing with in-memory store:', error);
          // Keep using the in-memory store
        }
      })();
    }
    return this.initializationPromise;
  }

  private getVectorStore(): InMemoryVectorStore | Collection {
    return this.chromaCollection || this.vectorStore;
  }

  async addDocument(document: LegalDocument): Promise<void> {
    try {
      console.log('Adding document to vector store:', { title: document.title, id: document.id });

      // Check cache first
      const cachedEmbedding = vectorCache.get(`doc_${document.id}`);
      let embedding;

      if (cachedEmbedding) {
        console.log('Using cached embedding for document:', document.id);
        embedding = cachedEmbedding.embedding;
      } else {
        embedding = await this.generateEmbedding(document.content);
        // Cache the result
        vectorCache.set(`doc_${document.id}`, { 
          embedding,
          metadata: {
            title: document.title,
            type: document.documentType,
            date: document.date.toISOString(),
            jurisdiction: document.jurisdiction
          }
        });
      }

      // Initialize ChromaDB in background if not already done
      this.initializeChromaDB().catch(console.error);

      // Store in vector database
      await this.getVectorStore().add({
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
    if (!this.getVectorStore()) {
      throw new Error('Vector store not initialized');
    }

    try {
      console.log('Searching similar cases for query:', query);

      const queryEmbedding = await this.generateEmbedding(query);

      const results = await this.getVectorStore().query({
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
    const cacheKey = `embedding_${Buffer.from(text).toString('base64').slice(0, 32)}`;
    const cachedEmbedding = vectorCache.get(cacheKey);

    if (cachedEmbedding) {
      console.log('Using cached embedding');
      return cachedEmbedding as number[];
    }

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

      const embedding = JSON.parse(content.text).embedding;
      vectorCache.set(cacheKey, embedding);
      return embedding;
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
      const normalizedVector = vector.map(val => val / (magnitude || 1));

      // Cache the fallback vector
      vectorCache.set(cacheKey, normalizedVector);
      return normalizedVector;
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