import { z } from "zod";
import { AnalysisResult, DocumentMetadata } from "@shared/types";

// Document classification schema
const documentClassificationSchema = z.object({
  documentType: z.string(),
  industry: z.string(),
  complianceStatus: z.string(),
  confidence: z.number(),
  classification: z.object({
    category: z.string(),
    subCategory: z.string(),
    tags: z.array(z.string()),
  }),
});

export class DocumentAnalyticsService {
  private async analyzeDocumentContent(content: string): Promise<z.infer<typeof documentClassificationSchema>> {
    try {
      // Use AI to analyze document content and classify
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze document content");
      }

      const result = await response.json();
      return documentClassificationSchema.parse(result);
    } catch (error) {
      console.error("Document analysis error:", error);
      throw error;
    }
  }

  async processWorkflowResults(workflowResults: any[]): Promise<DocumentMetadata> {
    const metadata: DocumentMetadata = {
      documentType: "Unknown",
      industry: "Unknown",
      complianceStatus: "Unknown",
      analysisTimestamp: new Date().toISOString(),
      confidence: 0,
      classifications: [],
      riskScore: 0,
    };

    try {
      // Process each workflow stage result
      for (const result of workflowResults) {
        if (result.stageType === "compliance") {
          metadata.complianceStatus = result.status;
          metadata.riskScore = result.riskScore || 0;
        } else if (result.stageType === "classification") {
          const analysis = await this.analyzeDocumentContent(result.content);
          metadata.documentType = analysis.documentType;
          metadata.industry = analysis.industry;
          metadata.confidence = analysis.confidence;
          metadata.classifications = [analysis.classification];
        }
      }

      return metadata;
    } catch (error) {
      console.error("Error processing workflow results:", error);
      throw error;
    }
  }

  async updateVaultDocument(documentId: string, metadata: DocumentMetadata): Promise<void> {
    try {
      const response = await fetch(`/api/vault/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata }),
      });

      if (!response.ok) {
        throw new Error("Failed to update vault document");
      }
    } catch (error) {
      console.error("Error updating vault document:", error);
      throw error;
    }
  }
}

export const documentAnalyticsService = new DocumentAnalyticsService();
