import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { type VaultDocument } from "@shared/schema";
import PDFParser from 'pdf2json';
import { promisify } from 'util';

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

async function parsePdfContent(pdfBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      try {
        const content = pdfData.Pages.map(page => 
          page.Texts.map(text => decodeURIComponent(text.R[0].T)).join(' ')
        ).join('\n');

        resolve(content);
      } catch (error) {
        reject(new Error(`PDF parsing failed: ${error.message}`));
      }
    });

    pdfParser.on("pdfParser_dataError", (error) => {
      reject(new Error(`PDF parsing error: ${error}`));
    });

    pdfParser.parseBuffer(pdfBuffer);
  });
}

export async function analyzeDocument(pdfBuffer: Buffer): Promise<DocumentAnalysis> {
  try {
    console.log("Starting multi-agent document analysis...");

    // Parse PDF content
    const content = await parsePdfContent(pdfBuffer);

    // Step 1: Initial analysis with Claude for classification
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
    "lastChecked": "2025-02-19T00:00:00Z"
  }
}

Document to analyze:
${content.substring(0, 8000)}`
      }],
    });

    // Parse Claude's response
    console.log("Claude analysis completed, parsing response...");
    let claudeAnalysis;
    try {
      claudeAnalysis = JSON.parse(claudeResponse.content[0].text);
    } catch (error) {
      console.error("Failed to parse Claude response:", error);
      throw new Error("Invalid response from Claude");
    }

    // Step 2: Detailed analysis with GPT-4 for deeper insights
    const gptResponse = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a compliance expert specializing in SOC reports. Focus on control effectiveness and compliance status. Provide a clear summary and actionable insights."
        },
        {
          role: "user",
          content: `Analyze this document and provide detailed insights:\n${content.substring(0, 8000)}`
        }
      ],
      temperature: 0.2,
      max_tokens: 1000
    });

    const summary = gptResponse.choices[0].message.content || "";

    // Combine analyses and return results
    const combinedAnalysis: DocumentAnalysis = {
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

    console.log("Document analysis completed successfully");
    return combinedAnalysis;

  } catch (error) {
    console.error("Document analysis error:", error);
    throw new Error("Failed to analyze document: " + (error as Error).message);
  }
}

export { parsePdfContent };