import { Anthropic } from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { legalDocuments } from '@shared/schema';
import type { LegalDocument } from '@shared/schema';
import { z } from 'zod';

// Initialize Anthropic client
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Validation schemas
const embeddingSchema = z.object({
  embedding: z.array(z.number()).length(1024)
});

const analysisSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  legalImplications: z.array(z.string()),
  recommendations: z.array(z.string()),
  riskAreas: z.array(z.string())
});

const summarySchema = z.object({
  executiveSummary: z.string(),
  keyPoints: z.array(z.string()),
  legalPrinciples: z.array(z.string()),
  timeline: z.array(z.object({
    date: z.string(),
    event: z.string()
  })),
  visualSuggestions: z.object({
    timelineData: z.array(z.object({
      year: z.number(),
      event: z.string()
    })),
    argumentMap: z.array(z.string()),
    citationNetwork: z.array(z.string())
  })
});

const queryAnalysisSchema = z.object({
  summary: z.string(),
  patternAnalysis: z.object({
    commonPrinciples: z.array(z.string()),
    outcomePatterns: z.array(z.string()),
    jurisdictionalTrends: z.array(z.string())
  }),
  timeline: z.array(z.object({
    date: z.string(),
    event: z.string(),
    significance: z.string()
  })),
  citationMap: z.array(z.object({
    case: z.string(),
    citedBy: z.array(z.string()),
    significance: z.string()
  })),
  recommendations: z.array(z.string())
});

// In-memory vector store for search functionality
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
  private prePopulatedDocuments: LegalDocument[] = [];
  private initialized: boolean = false;

  private constructor() {
    this.vectorStore = new InMemoryVectorStore();
    console.log('Initialized LegalResearchService with in-memory vector store');
  }

  static getInstance(): LegalResearchService {
    if (!LegalResearchService.instance) {
      LegalResearchService.instance = new LegalResearchService();
    }
    return LegalResearchService.instance;
  }

  async initialize() {
    if (!this.initialized) {
      try {
        await this.loadPrePopulatedDocuments();
        this.initialized = true;
        console.log('Legal research service initialized successfully');
      } catch (error) {
        console.error('Failed to initialize legal research service:', error);
        throw error;
      }
    }
  }

  async addDocument(document: LegalDocument): Promise<void> {
    try {
      console.log('Adding document:', { title: document.title, id: document.id });

      // First, save to database
      const [existingDoc] = await db
        .select()
        .from(legalDocuments)
        .where(eq(legalDocuments.id, document.id))
        .limit(1);

      if (!existingDoc) {
        await db.insert(legalDocuments).values(document);
      }

      // Then generate embedding and add to vector store
      const embedding = await this.generateEmbedding(document.content);

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

      console.log('Document added successfully:', { id: document.id });
    } catch (error) {
      console.error('Failed to add document:', error);
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
          content: `Generate a numerical embedding vector that captures the semantic meaning of this legal text. The vector should have exactly 1024 dimensions with values between -1 and 1.

Return ONLY a JSON object in this exact format, with no additional text:
{"embedding": [number1, number2, ..., number1024]}

Text to analyze:
${text.substring(0, 8000)}`
        }],
        temperature: 0.1
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Anthropic API');
      }

      try {
        const result = embeddingSchema.parse(JSON.parse(content.text));
        console.log('Successfully generated and validated embedding');
        return result.embedding;
      } catch (parseError) {
        console.error('Error parsing or validating embedding JSON:', parseError);
        throw new Error('Failed to generate valid embedding');
      }
    } catch (error) {
      console.error('Error in embedding generation:', error);
      throw error;
    }
  }

  private async loadPrePopulatedDocuments(): Promise<void> {
    try {
      console.log('Loading pre-populated documents...');
      const existingDocs = await db
        .select()
        .from(legalDocuments)
        .limit(1);

      if (existingDocs.length > 0) {
        console.log('Documents already loaded');
        return;
      }

      const landmarkCases: LegalDocument[] = [
        {
          id: 1,
          title: "Brown v. Board of Education",
          content: `347 U.S. 483 (1954). This landmark case overturned Plessy v. Ferguson and declared state laws establishing separate public schools for black and white students to be unconstitutional. The Supreme Court's unanimous decision stated that "separate educational facilities are inherently unequal."`,
          documentType: "CASE_LAW",
          jurisdiction: "United States",
          legalTopic: "Civil Rights",
          date: new Date("1954-05-17"),
          status: "ACTIVE",
          metadata: {
            court: "Supreme Court",
            citation: "347 U.S. 483"
          },
          citations: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      this.prePopulatedDocuments = landmarkCases;

      for (const doc of this.prePopulatedDocuments) {
        await this.addDocument(doc);
        console.log(`Added document: ${doc.title}`);
      }

      console.log('Pre-populated documents loaded successfully');
    } catch (error) {
      console.error('Error loading pre-populated documents:', error);
      throw error;
    }
  }

  async analyzeDocument(documentId: number): Promise<z.infer<typeof analysisSchema>> {
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
          content: `Analyze this legal document and provide a JSON response with exactly these fields:
{
  "summary": "A concise summary of the document",
  "keyPoints": ["Array of main points"],
  "legalImplications": ["Array of legal implications"],
  "recommendations": ["Array of recommendations"],
  "riskAreas": ["Array of risk areas"]
}

Document Title: ${document.title}
Content: ${document.content}`
        }],
        temperature: 0.1
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Anthropic API');
      }

      const analysis = analysisSchema.parse(JSON.parse(content.text));
      console.log('Analysis completed and validated');
      return analysis;

    } catch (error) {
      console.error('Error analyzing document:', error);
      throw error;
    }
  }

  async generateSummary(documentId: number): Promise<z.infer<typeof summarySchema>> {
    try {
      console.log('Generating summary for document:', documentId);
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
          content: `Generate a comprehensive summary of this legal document and return a JSON response with exactly these fields:
{
  "executiveSummary": "Brief overview",
  "keyPoints": ["Array of main points"],
  "legalPrinciples": ["Array of principles"],
  "timeline": [{"date": "string", "event": "string"}],
  "visualSuggestions": {
    "timelineData": [{"year": number, "event": "string"}],
    "argumentMap": ["Array of key arguments"],
    "citationNetwork": ["Array of citations"]
  }
}

Document Title: ${document.title}
Content: ${document.content}`
        }],
        temperature: 0.1
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Anthropic API');
      }

      const summary = summarySchema.parse(JSON.parse(content.text));
      console.log('Summary generated and validated');
      return summary;
    } catch (error) {
      console.error('Error generating summary:', error);
      throw error;
    }
  }

  async analyzeQuery(query: string): Promise<z.infer<typeof queryAnalysisSchema>> {
    try {
      console.log('Analyzing legal research query:', query);
      const similarCases = await this.searchSimilarCases(query);

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `Analyze this legal query and return a JSON response with exactly these fields:
{
  "summary": "Analysis of the query and cases",
  "patternAnalysis": {
    "commonPrinciples": ["Array of principles"],
    "outcomePatterns": ["Array of outcomes"],
    "jurisdictionalTrends": ["Array of trends"]
  },
  "timeline": [{"date": "string", "event": "string", "significance": "string"}],
  "citationMap": [{
    "case": "string",
    "citedBy": ["Array of citing cases"],
    "significance": "string"
  }],
  "recommendations": ["Array of recommendations"]
}

Query: ${query}

Similar Cases:
${similarCases.map(doc => `
Title: ${doc.title}
Content: ${doc.content}
Jurisdiction: ${doc.jurisdiction}
Date: ${doc.date}
`).join('\n')}`
        }],
        temperature: 0.1
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Anthropic API');
      }

      const analysis = queryAnalysisSchema.parse(JSON.parse(content.text));
      console.log('Query analysis completed and validated');
      return analysis;
    } catch (error) {
      console.error('Failed to analyze query:', error);
      throw error;
    }
  }

  async searchSimilarCases(query: string): Promise<LegalDocument[]> {
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

  getPrePopulatedDocuments(): LegalDocument[] {
    return this.prePopulatedDocuments;
  }
}

export const legalResearchService = LegalResearchService.getInstance();

// Initialize the service
legalResearchService.initialize().catch(console.error);