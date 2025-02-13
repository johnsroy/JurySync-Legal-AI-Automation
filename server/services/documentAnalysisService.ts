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
    console.log("Starting document analysis...");

    // Use Claude for initial analysis and classification
    const claudeResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `As a SOC compliance expert, analyze this document with focus on Google Workspace SOC reports. Identify:

1. Document Type: Look specifically for:
   - Google Workspace SOC 3 Report
   - Other SOC reports (SOC 1, SOC 2)
   - Google Cloud compliance documents
   - Other compliance certifications/reports

2. Industry: For Google/Tech companies, always classify as:
   - "Technology" for software/cloud services
   - Include sub-industry if mentioned

3. For SOC 3 reports:
   - Check if opinion is "unqualified" (PASSED)
   - Verify if report period is current
   - Look for any limitations/qualifications
   - Consider scope of services covered

Provide a JSON response with:
{
  "documentType": "e.g. Google Workspace SOC 3 Report",
  "industry": "Technology",
  "confidence": 0.95,
  "entities": ["Google LLC", "Google Workspace", etc],
  "keywords": ["SOC 3", "compliance", etc],
  "riskLevel": "LOW/MEDIUM/HIGH",
  "recommendations": ["Review scope of services", etc],
  "complianceStatus": {
    "status": "PASSED/FAILED/NOT_APPLICABLE",
    "details": "Detailed explanation"
  }
}

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
          content: "You are a SOC compliance expert specializing in Google Workspace and cloud service audits. Focus on compliance status, control effectiveness, and audit findings.",
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