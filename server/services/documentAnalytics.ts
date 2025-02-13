import { db } from "../db";
import { DocumentMetadata, WorkflowResult } from "@shared/types";
import { vaultDocumentAnalysis, type VaultDocumentAnalysis } from "@shared/schema";
import { eq } from "drizzle-orm";
import { openai } from "../openai";
import { anthropic } from "../anthropic";

export class DocumentAnalyticsService {
  private async analyzeWithAI(content: string) {
    const systemPrompt = `You are an expert document analyzer for legal and compliance documents.
Analyze the given document and extract key information about its type, industry context, and compliance status.
Focus on identifying:
1. Document classification (type of document)
2. Industry context (what sector/industry is this related to)
3. Key organizations mentioned
4. Overall compliance assessment

Respond in JSON format with the following structure:
{
  "documentType": "string",
  "industry": "string",
  "organizations": ["string"],
  "complianceStatus": "string",
  "confidence": number
}`;

    try {
      // Try OpenAI first
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(completion.choices[0].message.content);
      console.log('OpenAI Analysis:', result);
      return result;
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
        return result;
      } catch (anthropicError) {
        console.error("Both AI services failed:", anthropicError);
        throw new Error("Document analysis failed");
      }
    }
  }

  private mapIndustry(analysis: { industry: string, organizations: string[] }): string {
    // Try extracting from direct industry label
    const normalizedIndustry = analysis.industry.toUpperCase();
    if (['TECHNOLOGY', 'HEALTHCARE', 'FINANCIAL', 'MANUFACTURING', 'RETAIL'].includes(normalizedIndustry)) {
      return normalizedIndustry;
    }

    // Check organizations for industry hints
    const orgText = analysis.organizations.join(' ').toLowerCase();

    if (orgText.match(/google|microsoft|apple|amazon|meta|software|tech|cloud|cyber|digital/)) {
      return 'TECHNOLOGY';
    }
    if (orgText.match(/hospital|medical|health|pharma|biotech|clinic|patient/)) {
      return 'HEALTHCARE';
    }
    if (orgText.match(/bank|financial|insurance|investment|trading|credit/)) {
      return 'FINANCIAL';
    }
    if (orgText.match(/manufacturing|industrial|factory|production|assembly/)) {
      return 'MANUFACTURING';
    }
    if (orgText.match(/retail|store|shop|consumer|ecommerce|sales/)) {
      return 'RETAIL';
    }

    return 'TECHNOLOGY'; // Default fallback
  }

  private mapDocumentType(analysis: { documentType: string }): string {
    const type = analysis.documentType.toUpperCase();

    if (type.includes('SOC') || type.includes('AUDIT')) {
      return 'AUDIT';
    }
    if (type.includes('CONTRACT') || type.includes('AGREEMENT')) {
      return 'CONTRACT';
    }
    if (type.includes('POLICY') || type.includes('PROCEDURE')) {
      return 'POLICY';
    }
    if (type.includes('REPORT') || type.includes('ANALYSIS')) {
      return 'REPORT';
    }

    return 'REPORT'; // Default fallback
  }

  async processWorkflowResults(workflowResults: WorkflowResult[]): Promise<DocumentMetadata> {
    try {
      const classificationResult = workflowResults.find(result => 
        result.stageType === 'classification');

      if (!classificationResult?.content) {
        throw new Error("No classification content found");
      }

      const aiAnalysis = await this.analyzeWithAI(classificationResult.content);
      console.log('AI Analysis Result:', aiAnalysis);

      const documentType = this.mapDocumentType(aiAnalysis);
      const industry = this.mapIndustry(aiAnalysis);

      const metadata: DocumentMetadata = {
        documentType,
        industry,
        complianceStatus: aiAnalysis.complianceStatus,
        analysisTimestamp: new Date().toISOString(),
        confidence: aiAnalysis.confidence,
        classifications: [{
          category: "LEGAL",
          subCategory: documentType,
          tags: [industry, documentType, ...aiAnalysis.organizations]
        }],
        riskScore: aiAnalysis.complianceStatus.toLowerCase() === "compliant" ? 85 : 45
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
      console.log('Document Analysis Result:', aiAnalysis);

      const documentType = this.mapDocumentType(aiAnalysis);
      const industry = this.mapIndustry(aiAnalysis);

      const [result] = await db.insert(vaultDocumentAnalysis).values({
        documentId,
        fileName: `Document_${documentId}.pdf`,
        fileDate: new Date().toISOString(),
        documentType,
        industry,
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