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

// Document type mapping for accurate classification
const documentTypeMap: Record<string, string> = {
  "merger agreement": "M&A Agreement",
  "acquisition agreement": "M&A Agreement",
  "stock purchase": "M&A Agreement",
  "asset purchase": "M&A Agreement",
  "employment agreement": "Employment Contract",
  "service agreement": "Service Agreement",
  "soc report": "Compliance Report",
  "soc-2": "Compliance Report",
  "soc-3": "Compliance Report",
  "nda": "Non-Disclosure Agreement",
  "confidentiality": "Non-Disclosure Agreement",
  "lease": "Real Estate Agreement",
  "rental": "Real Estate Agreement",
};

export async function classifyDocument(content: string): Promise<DocumentClassification> {
  try {
    const response = await apiRequest('POST', '/api/analyze/classify', {
      content: content
    });

    const result = await response.json();
    const classification = result.classification;

    // Normalize document type based on content analysis
    const lowerContent = content.toLowerCase();
    let documentType = classification.documentType;

    // Check content against document type patterns
    for (const [pattern, type] of Object.entries(documentTypeMap)) {
      if (lowerContent.includes(pattern)) {
        documentType = type;
        break;
      }
    }

    // Override the document type if needed
    return {
      ...classification,
      documentType: documentType
    };
  } catch (error) {
    console.error("Document classification error:", error);
    throw new Error("Failed to classify document");
  }
}