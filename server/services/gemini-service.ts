import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface GeminiAnalysisResult {
  summary: string;
  insights: string[];
  recommendations: string[];
  confidence: number;
}

/**
 * Gemini Service for legal document analysis
 * Provides AI-powered analysis capabilities using Google's Gemini model
 */
export class GeminiService {
  private model;

  constructor() {
    this.model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  }

  /**
   * Analyzes legal text and provides insights
   */
  async analyzeText(content: string, context?: string): Promise<GeminiAnalysisResult> {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is not set");
      }

      const prompt = `
        Analyze the following legal text and provide:
        1. A concise summary
        2. Key insights
        3. Recommendations
        4. A confidence score (0-1)

        ${context ? `Context: ${context}` : ''}

        Text to analyze:
        ${content.substring(0, 10000)}

        Respond in JSON format:
        {
          "summary": "string",
          "insights": ["string"],
          "recommendations": ["string"],
          "confidence": number
        }
      `;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse Gemini response");
      }

      return JSON.parse(jsonMatch[0]) as GeminiAnalysisResult;
    } catch (error: any) {
      console.error('Gemini analysis error:', error);
      throw new Error(`Gemini analysis failed: ${error.message}`);
    }
  }

  /**
   * Extracts key entities from legal text
   */
  async extractEntities(content: string): Promise<{
    parties: string[];
    dates: string[];
    amounts: string[];
    clauses: string[];
  }> {
    try {
      const prompt = `
        Extract the following entities from this legal document:
        - Parties involved (names of individuals or companies)
        - Important dates
        - Monetary amounts
        - Key clauses or sections

        Document:
        ${content.substring(0, 8000)}

        Respond in JSON format:
        {
          "parties": ["string"],
          "dates": ["string"],
          "amounts": ["string"],
          "clauses": ["string"]
        }
      `;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { parties: [], dates: [], amounts: [], clauses: [] };
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error: any) {
      console.error('Entity extraction error:', error);
      return { parties: [], dates: [], amounts: [], clauses: [] };
    }
  }

  /**
   * Compares two documents and identifies differences
   */
  async compareDocuments(doc1: string, doc2: string): Promise<{
    differences: string[];
    similarities: string[];
    riskChanges: string[];
  }> {
    try {
      const prompt = `
        Compare these two legal documents and identify:
        1. Key differences
        2. Similarities
        3. Any changes that might affect risk

        Document 1:
        ${doc1.substring(0, 5000)}

        Document 2:
        ${doc2.substring(0, 5000)}

        Respond in JSON format:
        {
          "differences": ["string"],
          "similarities": ["string"],
          "riskChanges": ["string"]
        }
      `;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { differences: [], similarities: [], riskChanges: [] };
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error: any) {
      console.error('Document comparison error:', error);
      return { differences: [], similarities: [], riskChanges: [] };
    }
  }
}

// Export singleton instance
export const geminiService = new GeminiService();
