import { apiRequest } from "@/lib/queryClient";
import anthropic from "@/lib/anthropic";

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
    // First pass: Document classification
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Analyze this legal document and provide a structured classification:
          Document: ${content}

          Provide the analysis in this exact JSON format:
          {
            "documentType": string,
            "industry": string,
            "complianceStatus": "COMPLIANT" | "NON_COMPLIANT" | "PARTIALLY_COMPLIANT",
            "confidence": number,
            "details": {
              "keyFindings": string[],
              "recommendations": string[],
              "riskLevel": string
            }
          }`
      }]
    });

    const responseContent = response.content[0];
    if (!('text' in responseContent)) {
      throw new Error("Invalid AI response format");
    }

    const classification = JSON.parse(responseContent.text);

    // Apply document type mapping if found
    const lowerContent = content.toLowerCase();
    for (const [pattern, type] of Object.entries(documentTypeMap)) {
      if (lowerContent.includes(pattern)) {
        classification.documentType = type;
        break;
      }
    }

    return classification;
  } catch (error) {
    console.error("Document classification error:", error);
    throw new Error("Failed to classify document");
  }
}