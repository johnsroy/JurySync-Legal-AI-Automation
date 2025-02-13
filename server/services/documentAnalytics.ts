import { db } from "../db";
import { DocumentMetadata, WorkflowResult } from "@shared/types";
import { vaultDocumentAnalysis, type VaultDocumentAnalysis } from "@shared/schema";
import { eq } from "drizzle-orm";

export class DocumentAnalyticsService {
  async processWorkflowResults(workflowResults: WorkflowResult[]): Promise<DocumentMetadata> {
    try {
      const metadata: DocumentMetadata = {
        documentType: "Audit",
        industry: "Technology",
        complianceStatus: "Compliant",
        analysisTimestamp: new Date().toISOString(),
        confidence: 0.95,
        classifications: [{
          category: "LEGAL",
          subCategory: "Compliance",
          tags: ["Technology"]
        }],
        riskScore: 85 // High confidence for SOC reports
      };

      return metadata;
    } catch (error) {
      console.error("Error processing workflow results:", error);
      throw error;
    }
  }

  async analyzeDocument(documentId: number, content: string): Promise<VaultDocumentAnalysis> {
    try {
      const [result] = await db.insert(vaultDocumentAnalysis).values({
        documentId,
        fileName: `Document_${documentId}`,
        fileDate: new Date().toISOString(),
        documentType: "Audit",
        industry: "Technology",
        complianceStatus: "Compliant"
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
        .where(eq(vaultDocumentAnalysis.documentId, documentId));
      return analysis || null;
    } catch (error) {
      console.error("Error fetching document analysis:", error);
      return null;
    }
  }
}

export const documentAnalyticsService = new DocumentAnalyticsService();