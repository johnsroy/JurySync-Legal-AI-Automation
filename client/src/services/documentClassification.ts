import { apiRequest } from "@/lib/queryClient";
import { analyzeDocument, detectDocumentType, type DocumentAnalysis } from "./documentAIAnalysis";

export type { DocumentAnalysis };

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

export async function classifyDocument(content: string): Promise<DocumentAnalysis> {
  try {
    // First detect document type through pattern matching
    const baseDocumentType = detectDocumentType(content);

    // Get detailed AI analysis
    const analysis = await analyzeDocument(content);

    // Merge pattern-based detection with AI analysis
    // Prefer pattern detection for document type as it's more reliable for specific cases
    return {
      ...analysis,
      documentType: baseDocumentType === "Other Legal Document" ? analysis.documentType : baseDocumentType
    };
  } catch (error) {
    console.error("Document classification error:", error);
    throw new Error("Failed to classify document");
  }
}