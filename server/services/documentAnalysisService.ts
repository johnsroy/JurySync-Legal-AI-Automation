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
    console.log("Starting document analysis...");

    // Use Claude for initial analysis and classification
    const claudeResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Analyze this legal document and provide detailed JSON output. Follow these STRICT classification rules:

SOC Report Identification:
1. If the document mentions "System and Organization Controls (SOC)" or "SOC":
   - Look for "SOC 1", "SOC 2", or "SOC 3" mentions
   - Document Type MUST be exactly "SOC 1 Report", "SOC 2 Report", or "SOC 3 Report"
   - Industry should be based on the service organization (e.g., "Technology" for cloud/software providers)
   - Compliance: Check for phrases like "controls were effective" or "no material weaknesses"

Other Document Types:
- NDAs: Classify as "Non-Disclosure Agreement"
- Service Agreements: Classify as "Service Agreement"
- License Applications: Classify as "License Application"

Industry Classifications:
- Technology: For software, IT, cloud services
- Financial Services: For banking, insurance
- Healthcare: For medical, pharmaceutical

Required JSON Structure:
{
  "documentType": "string (MUST follow exact format for SOC reports)",
  "industry": "string (Technology, Financial Services, Healthcare, etc.)",
  "classification": "string",
  "confidence": number,
  "entities": string[],
  "keywords": string[],
  "riskLevel": "LOW|MEDIUM|HIGH",
  "recommendations": string[],
  "complianceStatus": {
    "status": "PASSED|FAILED|PENDING",
    "details": "string",
    "lastChecked": "ISO date string"
  }
}

Document to analyze:
${content.substring(0, 8000)}`
      }],
    });

    console.log("Claude analysis completed, parsing response...");
    const claudeAnalysis = JSON.parse(claudeResponse.content[0].text);

    // Use GPT-4 for summary
    const gptResponse = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert legal document analyst specializing in SOC reports and compliance documents. Focus on identifying document type and compliance status."
        },
        {
          role: "user",
          content: `Analyze this document and provide a clear summary, focusing on document type and compliance status:\n${content.substring(0, 8000)}`
        }
      ],
    });

    const summary = gptResponse.choices[0].message.content || "";
    console.log("Document analysis completed:", {
      documentType: claudeAnalysis.documentType,
      industry: claudeAnalysis.industry
    });

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