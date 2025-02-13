import { db } from "../db";
import { DocumentMetadata, WorkflowResult } from "@shared/types";
import { vaultDocumentAnalysis, type VaultDocumentAnalysis } from "@shared/schema";
import { eq } from "drizzle-orm";
import { openai } from "../openai";
import { anthropic } from "../anthropic";

// Define strict types for standardization
type StandardIndustry = 'TECHNOLOGY' | 'HEALTHCARE' | 'FINANCIAL' | 'MANUFACTURING' | 'RETAIL';
type StandardDocumentType = 'SOC Report' | 'Contract Agreement' | 'Policy Document' | 'Compliance Report';
type ComplianceStatus = 'Compliant' | 'Non-Compliant';

// Industry mapping configuration
const TECH_COMPANIES = [
  'google', 'microsoft', 'apple', 'amazon', 'meta', 'ibm', 'oracle', 'salesforce',
  'alphabet', 'workspace', 'cloud', 'aws', 'azure'
];

const TECH_KEYWORDS = [
  'software', 'cloud', 'computing', 'digital', 'tech', 'cyber', 'data',
  'platform', 'application', 'api', 'service', 'system'
];

export class DocumentAnalyticsService {
  private async analyzeWithAI(content: string) {
    const systemPrompt = `You are an expert legal document analyzer. For the given document, identify:

1. Document Type: Classify as one of: SOC Report, Contract Agreement, Policy Document, Compliance Report
2. Industry Context: Look for company names, industry terms, and sector-specific language
3. Compliance Status: Determine if compliant/non-compliant based on content

Respond with a JSON object:
{
  "documentType": "string",
  "industry": "string",
  "companyNames": ["string"],
  "keywords": ["string"],
  "complianceStatus": "string"
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: content }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(completion.choices[0].message.content);
      return this.standardizeResults(result);
    } catch (error) {
      console.error("OpenAI analysis failed, falling back to Anthropic:", error);

      try {
        const response = await anthropic.messages.create({
          model: "claude-3-opus-20240229",
          max_tokens: 1024,
          messages: [{ role: "user", content: `${systemPrompt}\n\n${content}` }]
        });

        const result = JSON.parse(response.content[0].text);
        return this.standardizeResults(result);
      } catch (anthropicError) {
        console.error("Both AI services failed:", anthropicError);
        throw new Error("Document analysis failed");
      }
    }
  }

  private standardizeResults(analysis: any) {
    // Standardize industry based on companies and keywords
    const allText = [
      ...(analysis.companyNames || []),
      ...(analysis.keywords || []),
      analysis.industry || ''
    ].join(' ').toLowerCase();

    // Map to standard industry
    let industry: StandardIndustry = 'TECHNOLOGY'; // Default to technology

    // Check for tech industry markers first
    const isTech = TECH_COMPANIES.some(company => allText.includes(company)) ||
                  TECH_KEYWORDS.some(keyword => allText.includes(keyword));

    if (isTech) {
      industry = 'TECHNOLOGY';
    } else if (allText.match(/hospital|medical|health|pharma|biotech/)) {
      industry = 'HEALTHCARE';
    } else if (allText.match(/bank|financial|investment|trading|credit/)) {
      industry = 'FINANCIAL';
    } else if (allText.match(/manufacturing|industrial|factory|production/)) {
      industry = 'MANUFACTURING';
    } else if (allText.match(/retail|store|commerce|consumer|sales/)) {
      industry = 'RETAIL';
    }

    // Standardize document type
    let documentType: StandardDocumentType = 'Compliance Report';
    if (analysis.documentType.toLowerCase().includes('soc')) {
      documentType = 'SOC Report';
    } else if (analysis.documentType.toLowerCase().includes('contract')) {
      documentType = 'Contract Agreement';
    } else if (analysis.documentType.toLowerCase().includes('policy')) {
      documentType = 'Policy Document';
    }

    // Standardize compliance status
    const complianceStatus: ComplianceStatus = 
      analysis.complianceStatus.toLowerCase().includes('non') ? 'Non-Compliant' : 'Compliant';

    return {
      documentType,
      industry,
      complianceStatus,
      confidence: 0.95
    };
  }

  async processWorkflowResults(workflowResults: WorkflowResult[]): Promise<DocumentMetadata> {
    try {
      const classificationResult = workflowResults.find(result => 
        result.stageType === 'classification');

      if (!classificationResult?.content) {
        throw new Error("No classification content found");
      }

      const analysis = await this.analyzeWithAI(classificationResult.content);
      console.log('Document Analysis Results:', analysis);

      const metadata: DocumentMetadata = {
        documentType: analysis.documentType,
        industry: analysis.industry,
        complianceStatus: analysis.complianceStatus,
        analysisTimestamp: new Date().toISOString(),
        confidence: analysis.confidence,
        classifications: [{
          category: "LEGAL",
          subCategory: analysis.documentType,
          tags: [analysis.industry]
        }],
        riskScore: analysis.complianceStatus === "Compliant" ? 85 : 45
      };

      return metadata;
    } catch (error) {
      console.error("Error processing workflow results:", error);
      throw error;
    }
  }

  async analyzeDocument(documentId: number, content: string): Promise<VaultDocumentAnalysis> {
    try {
      const analysis = await this.analyzeWithAI(content);
      console.log('Final Document Analysis:', analysis);

      const [result] = await db.insert(vaultDocumentAnalysis).values({
        documentId,
        fileName: `Document_${documentId}.pdf`,
        fileDate: new Date().toISOString(),
        documentType: analysis.documentType,
        industry: analysis.industry,
        complianceStatus: analysis.complianceStatus
      }).returning();

      return result;
    } catch (error) {
      console.error("Document analysis failed:", error);
      throw error;
    }
  }

  async getDocumentAnalysis(documentId: number): Promise<VaultDocumentAnalysis | null> {
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