import { apiRequest } from "@/lib/queryClient";

export interface DocumentClassification {
  documentType: string;
  industry: string;
  complianceStatus: string;
  confidence: number;
  details: {
    keyFindings: string[];
    recommendations: string[];
    riskLevel: string;
  };
}

export async function classifyDocument(content: string): Promise<DocumentClassification> {
  try {
    const response = await apiRequest('POST', '/api/analyze/classify', {
      content: content
    });
    
    const result = await response.json();
    return result.classification;
  } catch (error) {
    console.error("Document classification error:", error);
    throw new Error("Failed to classify document");
  }
}
