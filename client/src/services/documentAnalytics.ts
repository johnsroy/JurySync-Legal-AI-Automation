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
