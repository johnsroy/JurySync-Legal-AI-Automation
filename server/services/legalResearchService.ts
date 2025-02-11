import { Anthropic } from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { legalDocuments } from '@shared/schema';
import type { LegalDocument } from '@shared/schema';

// Initialize Anthropic client
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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

  async addDocument(document: LegalDocument): Promise<void> {
    try {
      console.log('Adding document:', { title: document.title, id: document.id });

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

Return only the numerical vector values as a JSON array with a single key "embedding":\n\n${text}`
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

      console.log('Analyzing document:', { id: documentId, title: document.title });

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
  "summary": "A concise summary of the document",
  "keyPoints": ["Array of main points"],
  "legalImplications": ["Array of legal implications"],
  "recommendations": ["Array of recommendations or next steps"],
  "riskAreas": ["Array of potential risk areas identified"]
}`
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Anthropic API');
      }

      console.log('Received Anthropic response');
      const analysis = JSON.parse(content.text);
      console.log('Analysis completed successfully');
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
          content: `Analyze this legal query using both retrieval-augmented generation and case-based reasoning. Consider:
1. Pattern recognition across similar cases
2. Common legal principles and their application
3. Outcome comparison and prediction
4. Timeline of legal developments
5. Citation relationships and precedent strength

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
  "patternAnalysis": {
    "commonPrinciples": ["Array of recurring legal principles"],
    "outcomePatterns": ["Array of similar outcomes and their conditions"],
    "jurisdictionalTrends": ["Array of jurisdiction-specific patterns"]
  },
  "timeline": [{"date": "string", "event": "string", "significance": "string"}],
  "citationMap": [{
    "case": "string",
    "citedBy": ["Array of cases citing this one"],
    "significance": "string"
  }],
  "recommendations": ["Array of recommendations based on pattern analysis"],
  "visualAids": {
    "timelineData": [{"year": Number, "event": "string", "impact": Number}],
    "citationNetwork": {
      "nodes": ["Array of case names"],
      "edges": [{"from": "string", "to": "string", "weight": Number}]
    }
  }
}`
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Anthropic API');
      }

      const analysis = JSON.parse(content.text);
      analysis.relevantCases = similarCases.map((doc) => ({
        document: doc,
        patternMatch: analysis.patternAnalysis?.commonPrinciples?.includes(doc.title) || false,
        significance: analysis.citationMap?.find((c: any) => c.case === doc.title)?.significance || "Related case"
      }));

      console.log('Query analysis completed successfully');
      return analysis;
    } catch (error) {
      console.error('Failed to analyze query:', error);
      throw error;
    }
  }

  async generateSummary(documentId: number): Promise<any> {
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
          content: `Generate a concise yet comprehensive summary of this legal document. Include:
1. Key legal principles and holdings
2. Main arguments and reasoning
3. Significant citations and precedents
4. Visual representation suggestions
5. Timeline of events

Document Title: ${document.title}
Content: ${document.content}

Provide your response in this JSON format:
{
  "executiveSummary": "Brief overview",
  "keyPoints": ["Array of main points"],
  "legalPrinciples": ["Array of principles"],
  "timeline": [{"date": "string", "event": "string"}],
  "visualSuggestions": {
    "timelineData": [{"year": Number, "event": "string"}],
    "argumentMap": ["Array of key arguments and their relationships"],
    "citationNetwork": ["Array of important citations and their connections"]
  }
}`
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Anthropic API');
      }

      const summary = JSON.parse(content.text);
      console.log('Summary generated successfully');
      return summary;
    } catch (error) {
      console.error('Error generating summary:', error);
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