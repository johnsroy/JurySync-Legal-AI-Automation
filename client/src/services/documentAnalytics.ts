import { apiRequest } from "@/lib/queryClient";

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
        body: JSON.stringify({ workflowResults })
      });

      if (response.ok) {
        const data = await response.json();
        return data as DocumentMetadata;
      }

      throw new Error('Failed to process workflow results');
    } catch (error) {
      console.error("Error processing workflow results:", error);
      throw error;
    }
  }
}

export const documentAnalyticsService = new DocumentAnalyticsService();