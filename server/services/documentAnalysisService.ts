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
    // First pass with Claude for detailed analysis
    const claudeResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are a specialized compliance document analyzer. Your task is to analyze this document with extremely high accuracy, especially for SOC compliance reports.

Analyze for:

1. Document Type - Be very specific:
   - For SOC reports: Specify exact type (SOC 1 Type I/II, SOC 2 Type I/II, SOC 3)
   - For other compliance docs: Specify standard (ISO 27001, HIPAA, etc.)
   - Include version/year if present

2. Industry - Be specific:
   - Primary industry (e.g., Cloud Technology, Financial Services)
   - Sub-industry if applicable (e.g., SaaS, Payment Processing)
   - Regulatory context if relevant

3. Compliance Status:
   - For SOC reports: 
     - PASSED if unqualified opinion / no exceptions
     - FAILED if qualified opinion / exceptions found
     - Include specific criteria met/unmet
   - For other compliance docs:
     - PASSED if fully compliant
     - FAILED if gaps exist
   - Details must explain the status

4. Additional Analysis:
   - Confidence score (0-1)
   - Key entities (companies, standards bodies)
   - Critical keywords
   - Risk level (LOW/MEDIUM/HIGH)
   - Specific recommendations

Respond in JSON format with these fields:
{
  "documentType": "string (be very specific)",
  "industry": "string (primary and sub-industry)",
  "complianceStatus": {
    "status": "PASSED/FAILED/NOT_APPLICABLE",
    "details": "string (specific explanation)"
  },
  "confidence": number,
  "entities": string[],
  "keywords": string[],
  "riskLevel": "string",
  "recommendations": string[]
}

Content to analyze:
${content.substring(0, 8000)}`
      }],
    });

    // Second pass with GPT-4 for verification and summary
    const gptResponse = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a SOC compliance and audit expert. Analyze this document focusing on compliance status, control objectives, and critical implications. Pay special attention to audit opinions and control effectiveness statements.",
        },
        {
          role: "user",
          content: content.substring(0, 8000),
        },
      ],
    });

    const summary = gptResponse.choices[0].message.content || "";
    const claudeAnalysis = JSON.parse(claudeResponse.content[0].text);

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