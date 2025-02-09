import { Anthropic } from '@anthropic-ai/sdk';
import { ChromaClient, Collection } from 'chromadb';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { legalDocuments, legalCitations } from '@shared/schema';
import type { LegalDocument, Citation } from '@shared/schema';

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

  private constructor() {
    // Initialize with in-memory store by default
    this.vectorStore = new InMemoryVectorStore();
    console.log('Initialized LegalResearchService with in-memory vector store');
  }

  static getInstance(): LegalResearchService {
    if (!LegalResearchService.instance) {
      LegalResearchService.instance = new LegalResearchService();
    }
    return LegalResearchService.instance;
  }

  async addDocument(document: LegalDocument): Promise<void> {
    try {
      console.log('Adding document:', { title: document.title, id: document.id });

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

      console.log('Document added successfully to vector store:', { id: document.id });
    } catch (error) {
      console.error('Failed to add document to vector store:', error);
      throw error;
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      console.log('Generating embedding for text length:', text.length);

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
      console.log('Successfully generated embedding');
      return result.embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Return a simple fallback embedding
      const vector = new Array(1024).fill(0);
      for (let i = 0; i < Math.min(text.length, 1024); i++) {
        vector[i] = text.charCodeAt(i) / 255;
      }
      return vector;
    }
  }

  async searchSimilarCases(query: string): Promise<any[]> {
    try {
      console.log('Searching similar cases for query:', query);
      const queryEmbedding = await this.generateEmbedding(query);

      const results = await this.vectorStore.query({
        queryEmbeddings: [queryEmbedding],
        nResults: 5
      });

      if (!results.ids?.length) {
        console.log('No similar cases found');
        return [];
      }

      const documentIds = results.ids[0].map(id => parseInt(id));
      const documents = await Promise.all(
        documentIds.map(async (id) => {
          const [doc] = await db
            .select()
            .from(legalDocuments)
            .where(eq(legalDocuments.id, id));
          return doc;
        })
      );

      console.log('Found similar cases:', documents.length);
      return documents.filter(Boolean);
    } catch (error) {
      console.error('Error searching similar cases:', error);
      return [];
    }
  }

  async analyzeDocument(documentId: number): Promise<any> {
    try {
      console.log('Analyzing document:', documentId);
      const [document] = await db
        .select()
        .from(legalDocuments)
        .where(eq(legalDocuments.id, documentId));

      if (!document) {
        throw new Error('Document not found');
      }

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this legal document and provide a structured analysis:

Document Title: ${document.title}
Content: ${document.content}

Provide your response in this JSON format:
{
  "summary": "Brief overview of the document",
  "keyPoints": ["Array of main points"],
  "legalImplications": ["Array of legal implications"],
  "recommendations": ["Array of recommendations"],
  "riskAreas": ["Array of potential risks"]
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
      console.log('Document analysis completed successfully');
      return analysis;
    } catch (error) {
      console.error('Error analyzing document:', error);
      throw error;
    }
  }
}

export const legalResearchService = LegalResearchService.getInstance();