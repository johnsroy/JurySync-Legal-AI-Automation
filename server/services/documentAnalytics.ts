import { db } from "../db";
import { DocumentMetadata, WorkflowResult } from "@shared/types";
import { vaultDocumentAnalysis, type VaultDocumentAnalysis } from "@shared/schema";
import { eq } from "drizzle-orm";
import { openai } from "../openai";
import { anthropic } from "../anthropic";

export class DocumentAnalyticsService {
  private async analyzeWithAI(content: string) {
    const systemPrompt = `You are an expert legal document analyzer. Given a document, identify:

1. Document Type: What kind of document is this? (e.g. Contract Agreement, SOC Report, Audit Report)
2. Industry: Based on companies mentioned and content, what industry is this for? (Technology, Healthcare, Financial Services, etc.)
3. Compliance: Is this document showing compliance or non-compliance?

Provide a simple JSON response like this:
{
  "documentType": "Contract Agreement",
  "industry": "Technology", 
  "complianceStatus": "Compliant"
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(completion.choices[0].message.content);
      return result;
    } catch (error) {
      console.error("OpenAI analysis failed, falling back to Anthropic:", error);

      try {
        const response = await anthropic.messages.create({
          model: "claude-3-opus-20240229",
          max_tokens: 1024,
          messages: [
            { role: "user", content: `${systemPrompt}\n\n${content}` }
          ]
        });

        const result = JSON.parse(response.content[0].text);
        return result;
      } catch (anthropicError) {
        console.error("Both AI services failed:", anthropicError);
        throw new Error("Document analysis failed");
      }
    }
  }

  async processWorkflowResults(workflowResults: WorkflowResult[]): Promise<DocumentMetadata> {
    try {
      const classificationResult = workflowResults.find(result => 
        result.stageType === 'classification');

      if (!classificationResult?.content) {
        throw new Error("No classification content found");
      }

      const analysis = await this.analyzeWithAI(classificationResult.content);

      const metadata: DocumentMetadata = {
        documentType: analysis.documentType,
        industry: analysis.industry,
        complianceStatus: analysis.complianceStatus,
        analysisTimestamp: new Date().toISOString(),
        confidence: 0.95,
        classifications: [{
          category: "LEGAL",
          subCategory: analysis.documentType,
          tags: [analysis.industry]
        }],
        riskScore: analysis.complianceStatus === "Compliant" ? 85 : 45
      };

      return metadata;
    } catch (error) {
      console.error("Error processing workflow results:", error);
      throw error;
    }
  }

  async analyzeDocument(documentId: number, content: string): Promise<VaultDocumentAnalysis> {
    try {
      const analysis = await this.analyzeWithAI(content);

      const [result] = await db.insert(vaultDocumentAnalysis).values({
        documentId,
        fileName: `Document_${documentId}.pdf`,
        fileDate: new Date().toISOString(),
        documentType: analysis.documentType,
        industry: analysis.industry,
        complianceStatus: analysis.complianceStatus
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