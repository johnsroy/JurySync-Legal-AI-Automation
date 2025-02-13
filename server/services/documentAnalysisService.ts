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
    console.log("Starting document analysis with content length:", content.length);

    // Use Claude for initial analysis and classification
    const claudeResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `You are a SOC compliance expert. Analyze this document and provide a JSON response with the following structure exactly:
{
  "documentType": "Google Workspace SOC 3 Report",
  "industry": "Technology",
  "confidence": 0.95,
  "entities": ["Google LLC", "Google Workspace"],
  "keywords": ["SOC 3", "compliance", "Google Workspace"],
  "riskLevel": "LOW",
  "recommendations": ["Review scope of services"],
  "complianceStatus": {
    "status": "PASSED",
    "details": "Unqualified opinion provided for the audit period"
  }
}

Do not include any other text in your response, only valid JSON. Determine if this is a SOC report and set appropriate values.

Content to analyze:
${content.substring(0, 8000)}`
          }
        ]
      }],
    });

    const claudeAnalysis = JSON.parse(claudeResponse.content[0].text);
    console.log("Claude analysis completed:", claudeAnalysis);

    // Use GPT-4 for summary
    const gptResponse = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a SOC compliance expert specializing in Google Workspace and cloud service audits. Provide a concise summary focusing on compliance status and key findings.",
        },
        {
          role: "user",
          content: content.substring(0, 8000),
        },
      ],
    });

    const summary = gptResponse.choices[0].message.content || "";
    console.log("GPT summary completed");

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