import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export interface DocumentMetadata {
  documentType: string;
  industry: string;
  complianceStatus: string;
  analysisTimestamp: string;
  confidence: number;
  classifications: Array<{
    category: string;
    subCategory: string;
    tags: string[];
  }>;
  riskScore: number;
}

class DocumentAnalyticsService {
  async processWorkflowResults(workflowResults: any[]): Promise<DocumentMetadata> {
    try {
      const response = await apiRequest("/api/document-analytics/process", {
        method: "POST",
        body: JSON.stringify({ workflowResults }),
      });

      return response as DocumentMetadata;
    } catch (error) {
      console.error("Error processing workflow results:", error);
      // Return default values if the API call fails
      return {
        documentType: "Unknown",
        industry: "Unknown",
        complianceStatus: "Unknown",
        analysisTimestamp: new Date().toISOString(),
        confidence: 0,
        classifications: [],
        riskScore: 0
      };
    }
  }
}

export const documentAnalyticsService = new DocumentAnalyticsService();

export async function fetchVaultAnalysis() {
  const response = await fetch("/api/vault/analysis");
  if (!response.ok) {
    throw new Error("Failed to fetch vault analysis");
  }
  return response.json();
}

export async function fetchDocumentAnalysis(documentId: number) {
  const response = await fetch(`/api/vault/analysis/${documentId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch document analysis");
  }
  return response.json();
}

export async function analyzeDocument(documentId: number, content: string) {
  const response = await fetch(`/api/vault/analyze/${documentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content })
  });

  if (!response.ok) {
    throw new Error("Failed to analyze document");
  }

  const result = await response.json();

  // Invalidate queries to refresh the UI
  await queryClient.invalidateQueries({ queryKey: ["/api/vault/analysis"] });
  await queryClient.invalidateQueries({ queryKey: ["/api/vault/analysis", documentId] });

  return result;
}