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

// Pre-populated legal documents
const prePopulatedDocuments = [
  {
    title: "Brown v. Board of Education",
    content: "This landmark case established that separate educational facilities are inherently unequal...",
    documentType: "SUPREME_COURT_DECISION",
    date: new Date("1954-05-17"),
    jurisdiction: "United States Supreme Court",
    citations: ["347 U.S. 483", "74 S. Ct. 686", "98 L. Ed. 873"]
  },
  {
    title: "Miranda v. Arizona",
    content: "This case established the requirement for law enforcement to inform arrestees of their rights...",
    documentType: "SUPREME_COURT_DECISION",
    date: new Date("1966-06-13"),
    jurisdiction: "United States Supreme Court",
    citations: ["384 U.S. 436", "86 S. Ct. 1602", "16 L. Ed. 2d 694"]
  },
  // Add more landmark cases
  {
    title: "Roe v. Wade",
    content: "This decision of the U.S. Supreme Court established a woman's legal right to abortion...",
    documentType: "SUPREME_COURT_DECISION",
    date: new Date("1973-01-22"),
    jurisdiction: "United States Supreme Court",
    citations: ["410 U.S. 113", "93 S. Ct. 705", "35 L. Ed. 2d 147"]
  }
];

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
    this.initializePrePopulatedDocuments();
    console.log('Initialized LegalResearchService with in-memory vector store');
  }

  private async initializePrePopulatedDocuments() {
    for (const doc of prePopulatedDocuments) {
      try {
        const [existingDoc] = await db
          .select()
          .from(legalDocuments)
          .where(eq(legalDocuments.title, doc.title));

        if (!existingDoc) {
          const [newDoc] = await db.insert(legalDocuments).values({
            title: doc.title,
            content: doc.content,
            documentType: doc.documentType,
            date: doc.date,
            jurisdiction: doc.jurisdiction
          }).returning();

          // Add citations
          for (const citation of doc.citations) {
            await db.insert(legalCitations).values({
              documentId: newDoc.id,
              citation: citation
            });
          }

          console.log(`Document created: ${doc.title}`);
          await this.addDocument(newDoc);
        } else {
          console.log(`Document already exists: ${doc.title}`);
        }
      } catch (error) {
        console.error(`Failed to initialize document ${doc.title}:`, error);
      }
    }
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
          content: `Generate a dense vector embedding for this legal text that captures its key legal concepts, principles, and arguments. Consider:
1. Legal principles and doctrines mentioned
2. Key facts and precedents
3. Legal reasoning and analysis
4. Citations and references
5. Jurisdictional context

Return only the numerical vector values as a JSON array:\n\n${text}`
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
          content: `Analyze this legal document comprehensively. Consider:
1. Key legal principles and holdings
2. Precedential value
3. Legal reasoning and analysis
4. Implications for future cases
5. Historical context and significance

Document Title: ${document.title}
Content: ${document.content}

Provide your response in this JSON format:
{
  "summary": "Brief overview of the document",
  "keyPoints": ["Array of main legal points"],
  "legalImplications": ["Array of legal implications"],
  "recommendations": ["Array of recommendations"],
  "precedentialValue": ["Array of precedential impacts"]
}`
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

  async analyzeQuery(query: string): Promise<any> {
    try {
      console.log('Analyzing legal research query:', query);
      const similarCases = await this.searchSimilarCases(query);

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        temperature: 0.2,
        messages: [{
          role: "user",
          content: `Analyze this legal query comprehensively. Consider:
1. Relevant case law and precedents
2. Legal principles and doctrines
3. Jurisdictional considerations
4. Historical development
5. Current trends and future implications

Query: ${query}

Similar Cases:
${similarCases.map(doc => `
Title: ${doc.title}
Content: ${doc.content}
Jurisdiction: ${doc.jurisdiction}
Date: ${doc.date}
`).join('\n')}

Structure your response as a JSON object with these fields:
{
  "summary": "A detailed analysis of the query and relevant cases",
  "relevantCases": [{"document": "CaseDocument", "relevance": "string", "keyHoldings": ["array of key holdings"]}],
  "timeline": [{"date": "string", "event": "string", "significance": "string"}],
  "recommendations": ["Array of recommendations based on the analysis"],
  "relatedPrinciples": ["Array of related legal principles and doctrines"],
  "riskFactors": ["Array of potential risks or challenges"]
}`
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Anthropic API');
      }

      const analysis = JSON.parse(content.text);
      analysis.relevantCases = similarCases.map((doc, index) => ({
        document: doc,
        relevance: analysis.relevantCases?.[index]?.relevance || "Related case",
        keyHoldings: analysis.relevantCases?.[index]?.keyHoldings || []
      }));

      console.log('Query analysis completed successfully');
      return analysis;
    } catch (error) {
      console.error('Failed to analyze query:', error);
      throw error;
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
}

export const legalResearchService = LegalResearchService.getInstance();