import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { type DocumentAnalysis } from "@shared/schema"; // Kept from original, assuming this is the correct import path.

// Initialize APIs
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CLAUDE_MODEL = "claude-3-sonnet-20240229";
const GPT_MODEL = "gpt-4-0125-preview";

interface DocumentAnalysisResult {
  summary: string;
  classification: string;
  industry: string;
  keywords: string[];
  confidence: number;
  entities: string[];
  riskLevel: string;
  recommendations: string[];
  documentType: string;
  complianceStatus: {
    status: 'PASSED' | 'FAILED' | 'PENDING';
    details: string;
    lastChecked: string;
  };
}

export async function analyzeDocument(content: string): Promise<DocumentAnalysisResult> {
  try {
    console.log("Starting document analysis with multi-agent system...");

    // Use Claude for initial analysis and classification
    const claudeResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Analyze this legal document and provide a structured analysis following this exact format:
{
  "documentType": "type of document (e.g., Contract, Policy, SOC Report)",
  "industry": "relevant industry",
  "classification": "document classification",
  "confidence": number between 0 and 1,
  "entities": ["array of entities mentioned"],
  "keywords": ["key terms and concepts"],
  "riskLevel": "HIGH/MEDIUM/LOW",
  "recommendations": ["action items"],
  "complianceStatus": {
    "status": "PASSED/FAILED/PENDING",
    "details": "compliance details",
    "lastChecked": "current timestamp"
  }
}

Document to analyze:
${content.substring(0, 8000)}`
      }]
    });

    // Parse Claude's structured response
    console.log("Parsing Claude analysis response...");
    const claudeAnalysis = JSON.parse(claudeResponse.content[0].value);

    // Use GPT-4 for detailed compliance analysis
    const gptResponse = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a compliance expert. Analyze this document and identify key compliance requirements, risks, and recommendations."
        },
        {
          role: "user",
          content: `Analyze this document for compliance:\n${content.substring(0, 8000)}`
        }
      ],
      temperature: 0.2,
    });

    const summary = gptResponse.choices[0].message.content || "";

    // Combine analyses from both models
    const result: DocumentAnalysisResult = {
      summary,
      ...claudeAnalysis,
      complianceStatus: {
        status: claudeAnalysis.complianceStatus.status || 'PENDING',
        details: claudeAnalysis.complianceStatus.details || summary,
        lastChecked: new Date().toISOString()
      }
    };

    console.log("Document analysis completed successfully");
    return result;

  } catch (error) {
    console.error("Document analysis error:", error);

    // Return a structured error response
    throw new Error(`Failed to analyze document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}