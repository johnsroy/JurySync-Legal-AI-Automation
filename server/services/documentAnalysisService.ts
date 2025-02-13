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
  documentType: string;
  industry: string;
  keywords: string[];
  confidence: number;
  entities: string[];
  riskLevel: string;
  recommendations: string[];
  complianceStatus: {
    status: 'PASSED' | 'FAILED' | 'NOT_APPLICABLE';
    details: string;
  };
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
        1. A specific document type (e.g., SOC 2 Report, SOC 3 Compliance, Privacy Policy, Terms of Service, etc.)
        2. Precise industry classification (e.g., Technology, Healthcare, Financial Services, etc.)
        3. A confidence score (0-1) for the classification
        4. Key entities mentioned (companies, individuals, organizations)
        5. Important keywords
        6. Risk level assessment (LOW, MEDIUM, HIGH)
        7. Key recommendations based on content analysis
        8. Compliance status (PASSED/FAILED/NOT_APPLICABLE) with explanation

        Respond in JSON format with these keys: documentType, industry, confidence, entities, keywords, riskLevel, recommendations, complianceStatus

        Content to analyze:
        ${content.substring(0, 8000)}`
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
          content: content.substring(0, 8000),
        },
      ],
    });

    const summary = gptResponse.choices[0].message.content || "";

    return {
      summary,
      classification: claudeAnalysis.documentType, 
      documentType: claudeAnalysis.documentType,
      industry: claudeAnalysis.industry,
      keywords: claudeAnalysis.keywords,
      confidence: claudeAnalysis.confidence,
      entities: claudeAnalysis.entities,
      riskLevel: claudeAnalysis.riskLevel,
      recommendations: claudeAnalysis.recommendations,
      complianceStatus: claudeAnalysis.complianceStatus,
    };
  } catch (error) {
    console.error("Document analysis error:", error);
    throw new Error("Failed to analyze document: " + (error as Error).message);
  }
}