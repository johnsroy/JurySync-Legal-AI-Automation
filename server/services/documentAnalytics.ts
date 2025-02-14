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
Analyze the document and provide the following key information:

1. Document Type Classification:
- Identify the specific document type (e.g., SOC Report, Merger Agreement, Compliance Report)
- Note any subtypes or specific frameworks

2. Industry Context:
- Identify the primary industry sector as one of: TECHNOLOGY, HEALTHCARE, FINANCIAL, MANUFACTURING, RETAIL
- Detect company names and their industry associations
- Look for industry-specific terminology

3. Compliance Assessment:
- Determine if the document indicates compliance or non-compliance
- Look for explicit statements about control effectiveness
- Check for audit opinions or assessment results
- Note any significant findings

Provide your analysis in JSON format:
{
  "documentType": "string",
  "industry": "string",
  "complianceStatus": "string",
  "confidence": number,
  "details": {
    "findings": ["string"],
    "recommendations": ["string"]
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
          messages: [
            { 
              role: "user", 
              content: `${systemPrompt}\n\nAnalyze this document:\n${content}`
            }
          ]
        });

        const result = JSON.parse(response.content[0].text);
        console.log('Anthropic Analysis:', result);
        return this.standardizeAnalysis(result, stageResults);

      } catch (anthropicError) {
        console.error("Both AI services failed:", anthropicError);
        throw new Error("Document analysis failed");
      }
    }
  }

  private standardizeAnalysis(analysis: any, stageResults?: WorkflowResult[]): StageAnalysis {
    // Get compliance status from workflow results if available
    let complianceStatus = 'Unknown';
    if (stageResults) {
      const complianceCheck = stageResults.find(r => r.stageType === 'compliance');
      if (complianceCheck) {
        complianceStatus = complianceCheck.status || 'Unknown';
      }
    }

    // Standardize document type based on content and keywords
    let documentType = 'Unknown';
    if (analysis.documentType) {
      const type = analysis.documentType.toLowerCase();
      if (type.includes('soc') || type.includes('audit')) {
        documentType = 'Compliance Report';
      } else if (type.includes('merger') || type.includes('acquisition')) {
        documentType = 'Merger Agreement';
      } else if (type.includes('compliance')) {
        documentType = 'Compliance Document';
      } else if (type.includes('policy') || type.includes('procedure')) {
        documentType = 'Policy Document';
      }
    }

    // Standardize industry based on content and company names
    let industry = 'Unknown';
    if (analysis.industry) {
      const industryText = analysis.industry.toLowerCase();

      if (industryText.match(/tech|software|digital|cyber|cloud/)) {
        industry = 'TECHNOLOGY';
      } else if (industryText.match(/health|medical|pharma|biotech/)) {
        industry = 'HEALTHCARE';
      } else if (industryText.match(/bank|finance|investment|trading/)) {
        industry = 'FINANCIAL';
      } else if (industryText.match(/manufacturing|industrial|production/)) {
        industry = 'MANUFACTURING';
      } else if (industryText.match(/retail|commerce|consumer/)) {
        industry = 'RETAIL';
      }
    }

    return {
      documentType,
      industry,
      complianceStatus: complianceStatus !== 'Unknown' ? complianceStatus : 
                       (analysis.complianceStatus || 'Pending Review'),
      complianceDetails: {
        score: analysis.confidence ? Math.round(analysis.confidence * 100) : 0,
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
        industry: aiAnalysis.industry || 'Unknown',
        complianceStatus: aiAnalysis.complianceStatus || 'Pending Review',
        analysisTimestamp: new Date().toISOString(),
        confidence: aiAnalysis.complianceDetails?.score || 0,
        classifications: [{
          category: "LEGAL",
          subCategory: aiAnalysis.documentType || 'Unknown',
          tags: [aiAnalysis.industry || 'Unknown']
        }],
        riskScore: aiAnalysis.complianceDetails?.score || 0
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
        industry: aiAnalysis.industry || 'Unknown',
        complianceStatus: aiAnalysis.complianceStatus || 'Pending Review'
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
  async getDocumentAnalysis(documentId: number): Promise<VaultDocumentAnalysis | null> {
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