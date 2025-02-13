import { db } from "../db";
import { DocumentMetadata, WorkflowResult } from "@shared/types";
import { vaultDocumentAnalysis, type VaultDocumentAnalysis } from "@shared/schema";
import { eq } from "drizzle-orm";
import { openai } from "../openai";
import { anthropic } from "../anthropic";

export class DocumentAnalyticsService {
  private async analyzeWithAI(content: string) {
    const systemPrompt = `You are an expert legal document analyzer specializing in document classification and compliance assessment.
Given a legal or business document, analyze it and extract the following key information:

1. Document Type Classification:
- Identify the specific document type (e.g., Contract Agreement, SOC Report, Audit Report, Policy Document)
- Note any subtypes or specific frameworks mentioned (e.g., SOC 1, SOC 2, SOC 3)

2. Industry Context:
- Identify the primary industry sector
- Detect company names and their industry associations
- Look for industry-specific terminology and compliance frameworks

3. Compliance Assessment:
- Determine if the document indicates compliance or non-compliance
- Look for explicit statements about control effectiveness
- Check for audit opinions or assessment results
- Note any significant findings or exceptions

Provide your analysis in the following JSON format:
{
  "documentType": "string",
  "documentSubtype": "string",
  "industry": "string",
  "organizations": ["string"],
  "complianceStatus": "string",
  "complianceDetails": {
    "effectiveness": "string",
    "findings": ["string"],
    "period": { "start": "string", "end": "string" }
  },
  "confidence": number
}`;

    try {
      // Try OpenAI first
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

      const result = JSON.parse(completion.choices[0].message.content);
      console.log('OpenAI Analysis:', result);
      return this.standardizeAnalysis(result);

    } catch (error) {
      console.error("OpenAI analysis failed, falling back to Anthropic:", error);

      try {
        // Fallback to Anthropic
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
        return this.standardizeAnalysis(result);

      } catch (anthropicError) {
        console.error("Both AI services failed:", anthropicError);
        throw new Error("Document analysis failed");
      }
    }
  }

  private standardizeAnalysis(analysis: any) {
    // Standardize document type
    let documentType = analysis.documentType.toUpperCase();
    if (documentType.includes('SOC') || documentType.includes('AUDIT')) {
      documentType = 'AUDIT';
    } else if (documentType.includes('CONTRACT') || documentType.includes('AGREEMENT')) {
      documentType = 'CONTRACT';
    } else if (documentType.includes('POLICY') || documentType.includes('PROCEDURE')) {
      documentType = 'POLICY';
    } else {
      documentType = 'REPORT';
    }

    // Standardize industry based on organizations and context
    let industry = analysis.industry.toUpperCase();
    const orgText = analysis.organizations.join(' ').toLowerCase();

    if (orgText.includes('google') || orgText.includes('microsoft') || 
        industry.includes('TECH') || industry.includes('SOFTWARE')) {
      industry = 'TECHNOLOGY';
    } else if (orgText.includes('hospital') || industry.includes('HEALTH')) {
      industry = 'HEALTHCARE';
    } else if (orgText.includes('bank') || industry.includes('FINANCIAL')) {
      industry = 'FINANCIAL';
    } else if (industry.includes('MANUFACTURING') || industry.includes('INDUSTRIAL')) {
      industry = 'MANUFACTURING';
    } else if (industry.includes('RETAIL') || industry.includes('COMMERCE')) {
      industry = 'RETAIL';
    } else {
      industry = 'TECHNOLOGY'; // Default to technology if unclear
    }

    // Determine compliance status from detailed analysis
    const complianceStatus = analysis.complianceDetails?.effectiveness?.toLowerCase().includes('effective') ||
                           analysis.complianceStatus?.toLowerCase().includes('compliant')
      ? 'Compliant'
      : 'Non-Compliant';

    return {
      documentType,
      documentSubtype: analysis.documentSubtype || documentType,
      industry,
      organizations: analysis.organizations || [],
      complianceStatus,
      complianceDetails: analysis.complianceDetails || {
        effectiveness: complianceStatus,
        findings: [],
        period: { start: '', end: '' }
      },
      confidence: analysis.confidence || 0.95
    };
  }

  async processWorkflowResults(workflowResults: WorkflowResult[]): Promise<DocumentMetadata> {
    try {
      const classificationResult = workflowResults.find(result => 
        result.stageType === 'classification');

      if (!classificationResult?.content) {
        throw new Error("No classification content found");
      }

      const aiAnalysis = await this.analyzeWithAI(classificationResult.content);
      console.log('Document Analysis Result:', aiAnalysis);

      const metadata: DocumentMetadata = {
        documentType: aiAnalysis.documentType,
        industry: aiAnalysis.industry,
        complianceStatus: aiAnalysis.complianceStatus,
        analysisTimestamp: new Date().toISOString(),
        confidence: aiAnalysis.confidence,
        classifications: [{
          category: "LEGAL",
          subCategory: aiAnalysis.documentSubtype,
          tags: [aiAnalysis.industry, ...aiAnalysis.organizations]
        }],
        riskScore: aiAnalysis.complianceStatus === "Compliant" ? 85 : 45
      };

      return metadata;
    } catch (error) {
      console.error("Error processing workflow results:", error);
      throw error;
    }
  }

  async analyzeDocument(documentId: number, content: string): Promise<VaultDocumentAnalysis> {
    try {
      const aiAnalysis = await this.analyzeWithAI(content);
      console.log('Final Document Analysis:', aiAnalysis);

      const [result] = await db.insert(vaultDocumentAnalysis).values({
        documentId,
        fileName: `Document_${documentId}.pdf`,
        fileDate: new Date().toISOString(),
        documentType: aiAnalysis.documentType,
        industry: aiAnalysis.industry,
        complianceStatus: aiAnalysis.complianceStatus
      }).returning();

      return result;
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