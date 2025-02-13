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
        content: `You are a specialized SOC compliance document analyzer. Analyze this document with extreme attention to detail and provide:

1. Document Type Classification:
   - If it's a SOC report, specify exact type (SOC 1, SOC 2, SOC 3)
   - For SOC 3 reports, identify if it's for specific services (e.g., Google Workspace, AWS, etc.)
   - If not SOC, categorize as: Compliance Certification, Audit Report, Privacy Policy, Terms of Service, or Other

2. Industry Classification (be specific):
   - Technology (specify: Cloud Services, SaaS, Infrastructure, etc.)
   - Financial Services
   - Healthcare
   - Other regulated industries

3. Detailed Compliance Analysis:
   - For SOC reports: Check if audit opinion is unqualified (PASSED) or qualified (FAILED)
   - Look for phrases like "successfully completed", "meets criteria", "no exceptions noted"
   - Check for control failures or exceptions
   - Identify validity period and scope
   - If not a compliance document: Mark as NOT_APPLICABLE

4. Additional Analysis:
   - Confidence score (0-1)
   - Key entities (companies, services, auditors)
   - Critical keywords
   - Risk level (LOW/MEDIUM/HIGH)
   - Key recommendations

Respond in JSON format with these keys:
{
  "documentType": string,
  "industry": string,
  "confidence": number,
  "entities": string[],
  "keywords": string[],
  "riskLevel": string,
  "recommendations": string[],
  "complianceStatus": {
    "status": "PASSED" | "FAILED" | "NOT_APPLICABLE",
    "details": string
  }
}

Document to analyze:
${content.substring(0, 8000)}`
      }],
    });

    const claudeAnalysis = JSON.parse(claudeResponse.content[0].text);

    // Use GPT-4 for detailed summary with focus on compliance
    const gptResponse = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a SOC compliance expert. Provide a concise but comprehensive summary focusing on compliance status, key findings, and critical implications. Pay special attention to audit opinions, control effectiveness, and any exceptions or qualifications.",
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