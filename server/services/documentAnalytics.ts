import { db } from "../db";
import { DocumentMetadata, WorkflowResult } from "@shared/types";
import { vaultDocumentAnalysis } from "@shared/schema";
import { eq } from "drizzle-orm";
import { openai } from "../openai";
import { anthropic } from "../anthropic";

interface StageAnalysis {
  documentType?: string;
  industry?: string;
  complianceStatus?: string;
  complianceDetails?: {
    score: number | null;
    findings: string[];
    scope: string | null;
    keyTerms: string[];
    recommendations: string[];
  };
}

export class DocumentAnalyticsService {
  // Enhanced document type classification
  private documentTypeMap = {
    // Compliance and Audit Reports
    'soc 2': 'SOC 2 Compliance Report',
    'soc2': 'SOC 2 Compliance Report',
    'soc 3': 'SOC 3 Compliance Report',
    'soc3': 'SOC 3 Compliance Report',
    'iso 27001': 'ISO 27001 Certification',
    'hipaa': 'HIPAA Compliance Report',
    'gdpr': 'GDPR Compliance Assessment',

    // Legal Agreements
    'merger': 'M&A Agreement',
    'acquisition': 'M&A Agreement',
    'stock purchase': 'M&A Agreement',
    'asset purchase': 'M&A Agreement',
    'nda': 'Non-Disclosure Agreement',
    'msa': 'Master Services Agreement',
    'sla': 'Service Level Agreement',
    'dpa': 'Data Processing Agreement',

    // Corporate Documents
    'bylaws': 'Corporate Bylaws',
    'operating agreement': 'Operating Agreement',
    'shareholder': 'Shareholder Agreement',
    'board resolution': 'Board Resolution',

    // Employment Documents
    'employment': 'Employment Agreement',
    'contractor': 'Independent Contractor Agreement',
    'consulting': 'Consulting Agreement',
    'compensation': 'Compensation Agreement',

    // IP and Technology
    'patent': 'Patent Documentation',
    'trademark': 'Trademark Registration',
    'copyright': 'Copyright Registration',
    'license': 'License Agreement',
    'saas': 'SaaS Agreement',

    // Real Estate
    'lease': 'Lease Agreement',
    'property': 'Property Agreement',
    'real estate': 'Real Estate Contract',

    // Financial
    'investment': 'Investment Agreement',
    'financing': 'Financing Agreement',
    'loan': 'Loan Agreement',
    'credit': 'Credit Agreement'
  };

  private async analyzeWithAI(content: string, stageResults?: WorkflowResult[]): Promise<StageAnalysis> {
    const maxLength = 8000;
    const truncatedContent = content.length > maxLength ?
      content.slice(0, maxLength) + "..." :
      content;

    const systemPrompt = `You are an expert legal and compliance document analyzer specializing in document classification and assessment.
Please analyze the document content and provide a response in this exact JSON format:
{
  "documentType": {
    "primary": "string - main document type (e.g. 'SOC 2', 'SOC 3', 'M&A Agreement')",
    "subtype": "string - specific type if applicable",
    "category": "string - document category (e.g. 'Compliance Report', 'Legal Agreement')"
  },
  "industry": "string - TECHNOLOGY, HEALTHCARE, FINANCIAL, MANUFACTURING, RETAIL",
  "complianceStatus": "string - Compliant, Non-Compliant, Needs Review",
  "confidence": "number - between 0 and 1",
  "details": {
    "findings": ["array of detailed findings"],
    "recommendations": ["array of specific recommendations"],
    "keyTerms": ["array of important terms found"],
    "scope": "string - document scope description"
  }
}

Be very specific about document types. Examples:
- SOC reports should specify SOC 1, SOC 2, or SOC 3
- M&A documents should specify type (merger agreement, stock purchase, asset purchase)
- Technology agreements should specify type (SaaS, license, maintenance)
- Compliance documents should specify the standard/framework

Look for key indicators like:
- Document headers and titles
- Standard compliance framework references
- Legal agreement type declarations
- Regulatory citations
- Industry-specific terminology

If you're not completely certain about any field, indicate lower confidence rather than guessing.`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Please analyze this document and identify its key characteristics:\n\n${truncatedContent}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");
      console.log('OpenAI Analysis:', result);
      return this.standardizeAnalysis(result, stageResults);

    } catch (error) {
      console.error("OpenAI analysis failed, falling back to Anthropic:", error);

      try {
        const response = await anthropic.messages.create({
          model: "claude-3-opus-20240229",
          max_tokens: 1024,
          temperature: 0,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Please perform a detailed analysis of this document, paying special attention to its type, industry context, and compliance implications:\n\n${truncatedContent}`
            }
          ]
        });

        const responseContent = response.content.find(c => c.type === 'text')?.text;
        if (!responseContent) {
          throw new Error("No text content in response");
        }

        let result;
        try {
          result = JSON.parse(responseContent);
        } catch (parseError) {
          console.error("Failed to parse Anthropic response:", parseError);
          const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("Could not extract valid JSON from response");
          }
        }

        console.log('Anthropic Analysis:', result);
        return this.standardizeAnalysis(result, stageResults);

      } catch (anthropicError) {
        console.error("Both AI services failed:", anthropicError);
        throw new Error("Document analysis failed with both AI services");
      }
    }
  }

  private standardizeAnalysis(analysis: any, stageResults?: WorkflowResult[]): StageAnalysis {
    if (!analysis || typeof analysis !== 'object') {
      throw new Error("Invalid analysis result");
    }

    // Extract document type with detailed handling
    let documentType = 'Unknown';
    if (analysis.documentType?.primary) {
      documentType = analysis.documentType.primary;
      if (analysis.documentType.subtype) {
        documentType = `${documentType} - ${analysis.documentType.subtype}`;
      }
    }

    // Use the documentTypeMap for more accurate classification
    const lowerContent = documentType.toLowerCase();
    for (const [key, value] of Object.entries(this.documentTypeMap)) {
      if (lowerContent.includes(key)) {
        documentType = value;
        break;
      }
    }

    // Map industry with extended categories
    const industryMap: { [key: string]: string } = {
      'tech': 'TECHNOLOGY',
      'software': 'TECHNOLOGY',
      'it': 'TECHNOLOGY',
      'digital': 'TECHNOLOGY',
      'health': 'HEALTHCARE',
      'medical': 'HEALTHCARE',
      'pharma': 'HEALTHCARE',
      'bank': 'FINANCIAL',
      'finance': 'FINANCIAL',
      'investment': 'FINANCIAL',
      'insurance': 'FINANCIAL',
      'manufacturing': 'MANUFACTURING',
      'industrial': 'MANUFACTURING',
      'production': 'MANUFACTURING',
      'retail': 'RETAIL',
      'commerce': 'RETAIL',
      'sales': 'RETAIL'
    };

    let industry = null;
    if (analysis.industry) {
      const lowercaseIndustry = analysis.industry.toLowerCase();
      for (const [key, value] of Object.entries(industryMap)) {
        if (lowercaseIndustry.includes(key)) {
          industry = value;
          break;
        }
      }
    }

    if (!industry) {
      // Look for industry indicators in the document type and key terms
      const keyTerms = analysis.details?.keyTerms || [];
      for (const term of keyTerms) {
        const lowercaseTerm = term.toLowerCase();
        for (const [key, value] of Object.entries(industryMap)) {
          if (lowercaseTerm.includes(key)) {
            industry = value;
            break;
          }
        }
        if (industry) break;
      }

      if (!industry) {
        industry = 'TECHNOLOGY'; //default to technology if industry cannot be determined
      }
    }

    // Validate compliance status
    const validComplianceStatuses = ['Compliant', 'Non-Compliant', 'Needs Review'];
    const complianceStatus = validComplianceStatuses.includes(analysis.complianceStatus)
      ? analysis.complianceStatus
      : 'Needs Review';

    return {
      documentType,
      industry,
      complianceStatus,
      complianceDetails: {
        score: analysis.confidence ? Math.round(analysis.confidence * 100) : null,
        findings: Array.isArray(analysis.details?.findings) ? analysis.details.findings : [],
        scope: analysis.details?.scope || null,
        keyTerms: Array.isArray(analysis.details?.keyTerms) ? analysis.details.keyTerms : [],
        recommendations: Array.isArray(analysis.details?.recommendations) ? analysis.details.recommendations : []
      }
    };
  }

  async analyzeDocument(documentId: number, content: string, workflowResults?: WorkflowResult[]): Promise<any> {
    try {
      console.log('Starting document analysis for ID:', documentId);
      const aiAnalysis = await this.analyzeWithAI(content, workflowResults);
      console.log('AI Analysis complete:', aiAnalysis);

      const [result] = await db.insert(vaultDocumentAnalysis).values({
        documentId,
        fileName: `Document_${documentId}.pdf`,
        fileDate: new Date().toISOString(),
        documentType: aiAnalysis.documentType,
        industry: aiAnalysis.industry,
        complianceStatus: aiAnalysis.complianceStatus
      }).returning();

      return {
        ...result,
        details: aiAnalysis.complianceDetails
      };
    } catch (error) {
      console.error("Document analysis failed:", error);
      throw error;
    }
  }

  async getDocumentAnalysis(documentId: number): Promise<any> {
    try {
      const [analysis] = await db
        .select()
        .from(vaultDocumentAnalysis)
        .where(eq(vaultDocumentAnalysis.documentId, documentId))
        .limit(1);

      return analysis || null;
    } catch (error) {
      console.error("Error fetching document analysis:", error);
      return null;
    }
  }
}

export const documentAnalyticsService = new DocumentAnalyticsService();