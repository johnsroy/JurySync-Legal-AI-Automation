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

    // Use Claude for initial analysis and classification with specific examples
    const claudeResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Analyze this legal document and provide detailed JSON output. Follow these examples EXACTLY:

Example 1 - SOC Report:
{
  "documentType": "SOC 3 Report",
  "industry": "Technology",
  "classification": "Compliance Report",
  "confidence": 0.95,
  "entities": ["Google", "Service Organization"],
  "keywords": ["controls", "security", "availability", "confidentiality"],
  "riskLevel": "LOW",
  "recommendations": ["Annual control assessment recommended", "Update security protocols"],
  "complianceStatus": {
    "status": "PASSED",
    "details": "All controls operating effectively",
    "lastChecked": "2025-02-13T00:00:00Z"
  }
}

Classification Rules:
1. SOC Documents:
   - If document mentions "System and Organization Controls (SOC)" or "SOC":
     * Set documentType to EXACTLY "SOC 3 Report", "SOC 2 Report", or "SOC 1 Report"
     * Set industry to "Technology" for tech companies
     * Set complianceStatus.status to "PASSED" if controls are effective

2. Industry Classifications:
   - Technology: For software, cloud services, IT companies
   - Financial Services: For banking, investment firms
   - Healthcare: For medical services, pharma

Document to analyze:
${content.substring(0, 8000)}`
      }],
    });

    console.log("Claude analysis completed, parsing response...");
    const claudeAnalysis = JSON.parse(claudeResponse.content[0].text);

    // Use GPT-4 for summary focusing on compliance
    const gptResponse = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a compliance expert specializing in SOC reports. Focus on control effectiveness and compliance status."
        },
        {
          role: "user",
          content: `Analyze this document and provide a clear summary, focusing on compliance status:\n${content.substring(0, 8000)}`
        }
      ],
    });

    const summary = gptResponse.choices[0].message.content || "";
    console.log("Document analysis completed:", {
      documentType: claudeAnalysis.documentType,
      industry: claudeAnalysis.industry,
      complianceStatus: claudeAnalysis.complianceStatus
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