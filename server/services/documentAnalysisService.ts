import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { type VaultDocument } from "@shared/schema";

// Initialize APIs
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const GPT_MODEL = "gpt-4o";

interface DocumentAnalysis {
  summary: string;
  classification: string;
  industry: string;
  keywords: string[];
  confidence: number;
  entities: string[];
  riskLevel: string;
  recommendations: string[];
  documentType: string;
}

export async function analyzeDocument(content: string): Promise<DocumentAnalysis> {
  try {
    // Use Claude for initial analysis and classification
    const claudeResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Analyze this legal document content and provide: 
        1. A classification (e.g., CONTRACT, BRIEF, CASE_LAW, LEGISLATION, CORRESPONDENCE, OTHER)
        2. Industry classification (e.g., FINANCIAL, TECHNOLOGY, HEALTHCARE, etc.)
        3. A confidence score (0-1) for the classification
        4. Key entities mentioned (companies, individuals, organizations)
        5. Important keywords
        6. Risk level assessment (LOW, MEDIUM, HIGH)
        7. Key recommendations based on content analysis
        8. Document type (e.g., Agreement, Contract, NDA, SLA, etc.)

        Respond in JSON format with these keys: classification, industry, confidence, entities, keywords, riskLevel, recommendations, documentType

        Document content:
        ${content.substring(0, 8000)} // Limit content length
        `
      }],
    });

    const claudeAnalysis = JSON.parse(claudeResponse.content[0].text);

    // Use GPT-4 for detailed summary
    const gptResponse = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a legal document analysis expert. Provide a concise but comprehensive summary of the document, focusing on key legal implications, risks, and important clauses.",
        },
        {
          role: "user",
          content: content.substring(0, 8000), // Limit content length
        },
      ],
    });

    const summary = gptResponse.choices[0].message.content || "";

    return {
      summary,
      classification: claudeAnalysis.classification,
      industry: claudeAnalysis.industry,
      keywords: claudeAnalysis.keywords,
      confidence: claudeAnalysis.confidence,
      entities: claudeAnalysis.entities,
      riskLevel: claudeAnalysis.riskLevel,
      recommendations: claudeAnalysis.recommendations,
      documentType: claudeAnalysis.documentType,
    };
  } catch (error) {
    console.error("Document analysis error:", error);
    throw new Error("Failed to analyze document: " + (error as Error).message);
  }
}