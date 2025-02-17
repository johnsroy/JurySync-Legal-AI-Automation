import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../db";
import { legalDocuments } from "@shared/schema";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface DeepResearchResult {
  summary: string;
  analysis: {
    legalPrinciples: string[];
    keyPrecedents: {
      case: string;
      relevance: string;
      impact: string;
    }[];
    recommendations: string[];
  };
  citations: {
    source: string;
    reference: string;
    context: string;
  }[];
}

export class GeminiLegalResearch {
  private model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  async performDeepResearch(query: string, context: string[]): Promise<DeepResearchResult> {
    try {
      const prompt = `
      As a legal research assistant, analyze the following query and provided context:
      
      Query: ${query}
      
      Context Documents:
      ${context.join('\n\n')}
      
      Provide a comprehensive legal analysis including:
      1. A detailed summary of findings
      2. Key legal principles identified
      3. Relevant precedents and their impact
      4. Specific recommendations
      5. Citations to support the analysis
      
      Format the response as a structured JSON object matching the DeepResearchResult interface.
      `;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Parse the JSON response
      return JSON.parse(text) as DeepResearchResult;
    } catch (error) {
      console.error('Gemini research error:', error);
      throw new Error('Failed to perform deep legal research');
    }
  }

  async searchAndAnalyze(query: string): Promise<DeepResearchResult> {
    // Fetch relevant documents from the database
    const documents = await db
      .select()
      .from(legalDocuments)
      .limit(10); // Adjust based on relevance later

    const context = documents.map(doc => `
      Title: ${doc.title}
      Content: ${doc.content}
      Jurisdiction: ${doc.jurisdiction}
      Date: ${doc.date}
    `);

    return this.performDeepResearch(query, context);
  }
}

export const geminiLegalResearch = new GeminiLegalResearch();
