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
      messages: [
        {
          role: "user",
          content: `You are an expert legal document analyzer. Analyze the document and provide detailed classification including:
            - Document type (be specific about M&A agreements, employment contracts, etc.)
            - Industry sector
            - Compliance status
            - Key findings
            - Potential risks
            - Recommendations

            Document content: ${content}

            Output in JSON format with the following structure:
            {
              "documentType": string,
              "industry": string,
              "complianceStatus": "COMPLIANT" | "NON_COMPLIANT" | "PARTIALLY_COMPLIANT",
              "confidence": number (0-100),
              "details": {
                "keyFindings": string[],
                "risks": string[],
                "recommendations": string[]
              },
              "metadata": {}
            }`
        }
      ]
    });

    if (!classificationResponse.content[0]?.text) {
      throw new Error("Invalid AI response format");
    }

    const analysis = JSON.parse(classificationResponse.content[0].text);

    // Second pass: Detailed compliance analysis
    const complianceResponse = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Based on the previous analysis, perform a detailed compliance check. Consider:
            - Regulatory requirements
            - Industry standards
            - Legal requirements
            - Best practices

            Previous analysis: ${JSON.stringify(analysis)}

            Provide additional compliance findings in the same JSON format.`
        }
      ]
    });

    if (!complianceResponse.content[0]?.text) {
      throw new Error("Invalid compliance analysis response");
    }

    const complianceDetails = JSON.parse(complianceResponse.content[0].text);

    // Merge both analyses
    return {
      ...analysis,
      details: {
        ...analysis.details,
        ...complianceDetails.details
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