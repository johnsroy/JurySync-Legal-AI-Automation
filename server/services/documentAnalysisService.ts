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
        content: `Analyze this legal document content and provide a detailed analysis. Follow these precise guidelines for classification:

        Document Type Classification Examples:
        - For SOC Reports: Classify exactly as "SOC 3 Report", "SOC 2 Report", or "SOC 1 Report"
        - For NDAs: Classify as "Non-Disclosure Agreement"
        - For Service Agreements: Classify as "Service Agreement"
        - For License Applications: Classify as "License Application"

        Industry Classification Examples:
        - Technology: For software, IT services, cloud providers
        - Financial Services: For banking, insurance, investment firms
        - Healthcare: For medical, pharmaceutical, healthcare providers

        Compliance Status Rules:
        - SOC Reports: "PASSED" if controls are effective, "FAILED" if significant deficiencies
        - Licenses: "PENDING" during application, "PASSED" when approved
        - Contracts: Based on risk assessment and completeness

        Special Rules for SOC Documents:
        1. Always check if document mentions:
           - "System and Organization Controls (SOC)"
           - Audit periods
           - Service organization details
        2. Look for effectiveness statements about controls
        3. Identify the specific type (SOC 1, 2, or 3)

        Document content to analyze:
        ${content.substring(0, 8000)}`
      }],
    });

    const claudeAnalysis = JSON.parse(claudeResponse.content[0].text);

    // Use GPT-4 for detailed summary with enhanced prompt
    const gptResponse = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert legal document analyst specializing in SOC reports and compliance documents. For SOC reports, pay special attention to control effectiveness and compliance status. Provide specific details about the type of SOC report and the audit findings."
        },
        {
          role: "user",
          content: `Analyze this document with focus on compliance status and technical details:\n${content.substring(0, 8000)}`
        }
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