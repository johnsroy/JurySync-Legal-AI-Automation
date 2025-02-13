import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { db } from "../db";
import { vaultDocuments } from "@shared/schema";
import { analyzeDocument } from "./documentAnalysisService";

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const GPT_MODEL = "gpt-4o";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface LegalDocumentExample {
  title: string;
  content: string;
  category: 'Reps & Warranties' | 'M&A Deal Points' | 'Compliance Analysis';
  source: string;
  metadata: Record<string, any>;
}

export class LegalDocumentService {
  // Get example documents for a specific category
  async getExampleDocuments(category: string): Promise<LegalDocumentExample[]> {
    try {
      let prompt = '';
      switch (category) {
        case 'Reps & Warranties':
          prompt = `Generate 5 detailed examples of Representations and Warranties clauses commonly found in legal agreements. For each example, include:
          1. Title of the agreement
          2. Specific representations and warranties
          3. Common industry contexts
          4. Key legal implications
          
          Format the response as a JSON array with objects containing title, content, category, and metadata fields.`;
          break;
        case 'M&A Deal Points':
          prompt = `Generate 5 detailed examples of M&A Deal Points from different types of merger and acquisition agreements. For each example, include:
          1. Type of M&A transaction
          2. Key deal terms
          3. Specific conditions and requirements
          4. Risk considerations
          
          Format the response as a JSON array with objects containing title, content, category, and metadata fields.`;
          break;
        case 'Compliance Analysis':
          prompt = `Generate 5 detailed examples of compliance requirements and analysis for different industries. For each example, include:
          1. Industry sector
          2. Regulatory framework
          3. Compliance requirements
          4. Risk assessment points
          
          Format the response as a JSON array with objects containing title, content, category, and metadata fields.`;
          break;
        default:
          throw new Error('Invalid category');
      }

      // Get examples from both AI models for comprehensive coverage
      const [claudeResponse, gptResponse] = await Promise.all([
        anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: prompt
          }],
        }),
        openai.chat.completions.create({
          model: GPT_MODEL,
          messages: [{
            role: "user",
            content: prompt
          }],
          response_format: { type: "json_object" }
        })
      ]);

      // Combine and process responses
      const claudeExamples = JSON.parse(claudeResponse.content[0].text);
      const gptExamples = JSON.parse(gptResponse.choices[0].message.content);
      
      return [...claudeExamples, ...gptExamples].map(example => ({
        ...example,
        source: 'AI Generated Example',
        category
      }));

    } catch (error) {
      console.error('Error generating example documents:', error);
      throw error;
    }
  }

  // Upload and categorize a new document
  async uploadAndCategorize(
    content: string,
    userId: number,
    preferredCategory?: string
  ): Promise<any> {
    try {
      // Analyze document using existing service
      const analysis = await analyzeDocument(content);

      // Additional category-specific analysis
      const categoryAnalysis = await this.performCategoryAnalysis(content, preferredCategory);

      // Store document with enhanced metadata
      const [document] = await db
        .insert(vaultDocuments)
        .values({
          title: categoryAnalysis.title,
          content,
          documentType: analysis.classification,
          aiSummary: analysis.summary,
          aiClassification: categoryAnalysis.category,
          metadata: {
            ...analysis,
            categorySpecificAnalysis: categoryAnalysis.analysis,
            confidence: categoryAnalysis.confidence,
            category: preferredCategory || categoryAnalysis.category
          },
          userId
        })
        .returning();

      return document;
    } catch (error) {
      console.error('Error uploading and categorizing document:', error);
      throw error;
    }
  }

  // Perform category-specific analysis
  private async performCategoryAnalysis(content: string, preferredCategory?: string) {
    const prompt = `Analyze this legal document and determine:
    1. The most appropriate category (Reps & Warranties, M&A Deal Points, or Compliance Analysis)
    2. Key elements specific to the category
    3. Confidence score for the categorization
    4. Suggested title based on content
    
    Document content:
    ${content.substring(0, 8000)}
    
    Respond in JSON format with keys: category, analysis, confidence, title`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: prompt
      }],
    });

    return JSON.parse(response.content[0].text);
  }
}

export const legalDocumentService = new LegalDocumentService();
