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
  complianceStatus?: {
    status: 'PASSED' | 'FAILED' | 'PENDING';
    details: string;
    lastChecked: string;
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
        content: `Analyze this legal document content and provide a detailed analysis. Here are specific examples of how to classify different document types:

        Examples:
        1. For SOC Reports:
           - Document Type: "SOC 3 Report" (if it's a SOC 3 report)
           - Industry: "Technology" (for tech companies like Google)
           - Compliance Status: "PASSED" (if controls are effective)

        2. For Legal Agreements:
           - Document Type: "Service Agreement", "NDA", etc.
           - Industry: Based on document context
           - Compliance Status: Based on risk assessment

        Pay special attention to:
        1. Document Type (e.g., "SOC 3 Report", "Contract", "NDA", etc.)
        2. Industry Classification (e.g., "Technology", "Financial Services", "Healthcare")
        3. Compliance Status
           - For SOC reports: PASSED if controls are effective
           - For contracts: Based on risk assessment
        4. Key entities mentioned
        5. Risk assessment
        6. Keywords
        7. Recommendations

        For SOC reports specifically:
        - Identify report type (SOC 1, 2, or 3)
        - Note compliance period
        - Extract service organization name
        - List key controls assessed

        Respond in JSON format with these keys: 
        {
          "classification": "string",
          "industry": "string",
          "confidence": number,
          "entities": string[],
          "keywords": string[],
          "riskLevel": "LOW|MEDIUM|HIGH",
          "recommendations": string[],
          "documentType": "string",
          "complianceStatus": {
            "status": "PASSED|FAILED|PENDING",
            "details": "string",
            "lastChecked": "ISO date string"
          }
        }

        Document content:
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
          content: "You are an expert legal document analyst. Provide a concise but comprehensive summary focusing on key legal implications, risks, and important clauses. For SOC reports, highlight the effectiveness of controls and compliance status.",
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
      classification: claudeAnalysis.classification,
      industry: claudeAnalysis.industry,
      keywords: claudeAnalysis.keywords,
      confidence: claudeAnalysis.confidence,
      entities: claudeAnalysis.entities,
      riskLevel: claudeAnalysis.riskLevel,
      recommendations: claudeAnalysis.recommendations,
      documentType: claudeAnalysis.documentType,
      complianceStatus: claudeAnalysis.complianceStatus
    };
  } catch (error) {
    console.error("Document analysis error:", error);
    throw new Error("Failed to analyze document: " + (error as Error).message);
  }
}