import { apiRequest } from "@/lib/queryClient";
import anthropic from "@/lib/anthropic";

export interface DocumentAnalysis {
  documentType: string;
  industry: string;
  complianceStatus: string;
  confidence: number;
  details: {
    keyFindings: string[];
    risks: string[];
    recommendations: string[];
  };
  metadata: Record<string, any>;
}

export async function analyzeDocument(content: string): Promise<DocumentAnalysis> {
  try {
    // First pass: Document classification and type detection
    const classificationResponse = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Analyze this legal document and provide a structured analysis with:
          - Document type (be specific, especially for M&A agreements)
          - Industry sector
          - Compliance status
          - Key findings
          - Risks
          - Recommendations

          Document: ${content}

          Provide the analysis in this exact JSON format:
          {
            "documentType": string,
            "industry": string,
            "complianceStatus": "COMPLIANT" | "NON_COMPLIANT" | "PARTIALLY_COMPLIANT",
            "confidence": number,
            "details": {
              "keyFindings": string[],
              "risks": string[],
              "recommendations": string[]
            }
          }`
      }]
    });

    // Extract content safely from the response
    const responseContent = classificationResponse.content[0];
    if (!('text' in responseContent)) {
      throw new Error("Invalid AI response format");
    }

    const analysis: DocumentAnalysis = JSON.parse(responseContent.text);

    // Second pass: Detailed compliance analysis
    const complianceResponse = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Based on this analysis, provide additional compliance insights.
          Consider regulatory requirements, industry standards, and legal requirements.
          Previous analysis: ${JSON.stringify(analysis)}

          Provide additional findings in the same JSON format.`
      }]
    });

    const complianceContent = complianceResponse.content[0];
    if (!('text' in complianceContent)) {
      throw new Error("Invalid compliance analysis response");
    }

    const complianceDetails = JSON.parse(complianceContent.text);

    // Merge analyses while maintaining type safety
    return {
      documentType: analysis.documentType,
      industry: analysis.industry,
      complianceStatus: analysis.complianceStatus,
      confidence: analysis.confidence,
      details: {
        keyFindings: [...analysis.details.keyFindings, ...(complianceDetails.details?.keyFindings || [])],
        risks: [...analysis.details.risks, ...(complianceDetails.details?.risks || [])],
        recommendations: [...analysis.details.recommendations, ...(complianceDetails.details?.recommendations || [])]
      },
      metadata: {
        ...analysis.metadata,
        ...complianceDetails.metadata
      }
    };
  } catch (error) {
    console.error("Document AI analysis error:", error);
    throw new Error("Failed to analyze document");
  }
}

// Helper function to detect document type patterns
export function detectDocumentType(content: string): string {
  const lowerContent = content.toLowerCase();

  // M&A related patterns
  if (
    lowerContent.includes("merger") ||
    lowerContent.includes("acquisition") ||
    lowerContent.includes("stock purchase") ||
    lowerContent.includes("asset purchase")
  ) {
    return "M&A Agreement";
  }

  // Compliance document patterns
  if (
    lowerContent.includes("soc") ||
    lowerContent.includes("compliance") ||
    lowerContent.includes("audit report")
  ) {
    return "Compliance Report";
  }

  // Employment related patterns
  if (
    lowerContent.includes("employment") ||
    lowerContent.includes("work agreement") ||
    lowerContent.includes("job contract")
  ) {
    return "Employment Contract";
  }

  // Default fallback
  return "Other Legal Document";
}