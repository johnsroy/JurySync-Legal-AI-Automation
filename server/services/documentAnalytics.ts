import { db } from "../db";
import { DocumentMetadata, WorkflowResult } from "@shared/types";
import { vaultDocumentAnalysis } from "@shared/schema";
import { eq } from "drizzle-orm";
import { openai } from "../openai";
import { anthropic } from "../anthropic";

interface StageAnalysis {
  documentType?: string;
  industry?: string;
  complianceStatus?: string;
  complianceDetails?: {
    score: number;
    findings: string[];
  };
}

export class DocumentAnalyticsService {
  private async analyzeWithAI(content: string, stageResults?: WorkflowResult[]) {
    const systemPrompt = `You are an expert legal document analyzer specializing in document classification and compliance assessment.
Analyze the document and provide the following key information in JSON format:

{
  "documentType": "string - document type",
  "industry": "string - one of: TECHNOLOGY, HEALTHCARE, FINANCIAL, MANUFACTURING, RETAIL",
  "complianceStatus": "string - one of: Compliant, Non-Compliant, Needs Review",
  "confidence": "number - between 0 and 1",
  "details": {
    "findings": ["array of string findings"],
    "recommendations": ["array of string recommendations"]
  }
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Please analyze this document and identify its key characteristics:\n\n${content}`
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");
      console.log('OpenAI Analysis:', result);
      return this.standardizeAnalysis(result, stageResults);

    } catch (error) {
      console.error("OpenAI analysis failed, falling back to Anthropic:", error);

      try {
        const response = await anthropic.messages.create({
          model: "claude-3-opus-20240229",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            { 
              role: "user", 
              content: `Analyze this document:\n${content}`
            }
          ]
        });

        // Ensure we're getting a string response
        const responseContent = response.content.find(c => c.type === 'text')?.text;
        if (!responseContent) {
          throw new Error("No text content in response");
        }

        const result = JSON.parse(responseContent);
        console.log('Anthropic Analysis:', result);
        return this.standardizeAnalysis(result, stageResults);

      } catch (anthropicError) {
        console.error("Both AI services failed:", anthropicError);
        // Return default values instead of throwing
        return {
          documentType: "Unknown",
          industry: "TECHNOLOGY",
          complianceStatus: "Compliant",
          complianceDetails: {
            score: 85,
            findings: ["Document analysis failed, using default values"]
          }
        };
      }
    }
  }

  private standardizeAnalysis(analysis: any, stageResults?: WorkflowResult[]): StageAnalysis {
    let complianceStatus = 'Compliant'; // Default to Compliant
    if (stageResults) {
      const complianceCheck = stageResults.find(r => r.stageType === 'compliance');
      if (complianceCheck) {
        complianceStatus = complianceCheck.status || 'Compliant';
      }
    }

    // Standardize document type based on content and keywords
    let documentType = analysis.documentType || 'Unknown';

    // Standardize industry mapping
    const industryMap: { [key: string]: string } = {
      'tech': 'TECHNOLOGY',
      'software': 'TECHNOLOGY',
      'digital': 'TECHNOLOGY',
      'health': 'HEALTHCARE',
      'medical': 'HEALTHCARE',
      'pharma': 'HEALTHCARE',
      'bank': 'FINANCIAL',
      'finance': 'FINANCIAL',
      'investment': 'FINANCIAL',
      'manufacturing': 'MANUFACTURING',
      'industrial': 'MANUFACTURING',
      'retail': 'RETAIL',
      'commerce': 'RETAIL'
    };

    let industry = 'TECHNOLOGY'; // Default to TECHNOLOGY
    if (analysis.industry) {
      const lowercaseIndustry = analysis.industry.toLowerCase();
      for (const [key, value] of Object.entries(industryMap)) {
        if (lowercaseIndustry.includes(key)) {
          industry = value;
          break;
        }
      }
    }

    return {
      documentType,
      industry,
      complianceStatus: analysis.complianceStatus || complianceStatus,
      complianceDetails: {
        score: analysis.confidence ? Math.round(analysis.confidence * 100) : 85,
        findings: analysis.details?.findings || []
      }
    };
  }

  async processWorkflowResults(workflowResults: WorkflowResult[]): Promise<DocumentMetadata> {
    try {
      const classificationResult = workflowResults.find(result => 
        result.stageType === 'classification');

      if (!classificationResult?.content) {
        throw new Error("No classification content found");
      }

      const aiAnalysis = await this.analyzeWithAI(classificationResult.content, workflowResults);
      console.log('Document Analysis Result:', aiAnalysis);

      const metadata: DocumentMetadata = {
        documentType: aiAnalysis.documentType || 'Unknown',
        industry: aiAnalysis.industry || 'TECHNOLOGY',
        complianceStatus: aiAnalysis.complianceStatus || 'Compliant',
        analysisTimestamp: new Date().toISOString(),
        confidence: aiAnalysis.complianceDetails?.score || 85,
        classifications: [{
          category: "LEGAL",
          subCategory: aiAnalysis.documentType || 'Unknown',
          tags: [aiAnalysis.industry || 'TECHNOLOGY']
        }],
        riskScore: aiAnalysis.complianceDetails?.score || 85
      };

      return metadata;
    } catch (error) {
      console.error("Error processing workflow results:", error);
      throw error;
    }
  }

  async analyzeDocument(documentId: number, content: string, workflowResults?: WorkflowResult[]): Promise<any> {
    try {
      const aiAnalysis = await this.analyzeWithAI(content, workflowResults);
      console.log('Final Document Analysis:', aiAnalysis);

      const [result] = await db.insert(vaultDocumentAnalysis).values({
        documentId,
        fileName: `Document_${documentId}.pdf`,
        fileDate: new Date().toISOString(),
        documentType: aiAnalysis.documentType || 'Unknown',
        industry: aiAnalysis.industry || 'TECHNOLOGY',
        complianceStatus: aiAnalysis.complianceStatus || 'Compliant'
      }).returning();

      return {
        ...result,
        details: aiAnalysis.complianceDetails
      };
    } catch (error) {
      console.error("Document analysis failed:", error);
      throw error;
    }
  }
  async getDocumentAnalysis(documentId: number): Promise<any> {
    try {
      const [analysis] = await db
        .select()
        .from(vaultDocumentAnalysis)
        .where(eq(vaultDocumentAnalysis.documentId, documentId))
        .limit(1);

      return analysis || null;
    } catch (error) {
      console.error("Error fetching document analysis:", error);
      return null;
    }
  }
}

export const documentAnalyticsService = new DocumentAnalyticsService();