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
    score: number;
    findings: string[];
  };
}

export class DocumentAnalyticsService {
  private async analyzeWithAI(content: string, stageResults?: WorkflowResult[]): Promise<StageAnalysis> {
    // Truncate content if too long
    const maxLength = 8000;
    const truncatedContent = content.length > maxLength ? 
      content.slice(0, maxLength) + "..." : 
      content;

    const systemPrompt = `You are an expert legal document analyzer specializing in document classification and compliance assessment.
Please analyze the document content and provide a response in this exact JSON format:
{
  "documentType": "string - document type (e.g. 'Contract', 'SOC 3 Report', 'Policy')",
  "industry": "string - TECHNOLOGY, HEALTHCARE, FINANCIAL, MANUFACTURING, RETAIL",
  "complianceStatus": "string - Compliant, Non-Compliant, Needs Review",
  "confidence": "number - between 0 and 1",
  "details": {
    "findings": ["array of string findings"],
    "recommendations": ["array of string recommendations"]
  }
}`;

    try {
      // First try OpenAI
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
        // Fallback to Anthropic
        const response = await anthropic.messages.create({
          model: "claude-3-opus-20240229",
          max_tokens: 1024,
          temperature: 0,
          system: systemPrompt,
          messages: [
            { 
              role: "user", 
              content: `Analyze this document:\n${truncatedContent}`
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
          // Extract JSON from the response if it's embedded in other text
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
        // Return default values instead of throwing
        return {
          documentType: "Unknown",
          industry: "TECHNOLOGY",
          complianceStatus: "Needs Review",
          complianceDetails: {
            score: 50,
            findings: ["Document analysis failed, manual review required"]
          }
        };
      }
    }
  }

  private standardizeAnalysis(analysis: any, stageResults?: WorkflowResult[]): StageAnalysis {
    // Ensure we have a valid analysis object
    if (!analysis || typeof analysis !== 'object') {
      analysis = {};
    }

    // Default compliance status
    let complianceStatus = 'Needs Review';
    if (stageResults) {
      const complianceCheck = stageResults.find(r => r.stageType === 'compliance');
      if (complianceCheck) {
        complianceStatus = complianceCheck.status || 'Needs Review';
      }
    }

    // Map common document types to standardized values
    const documentTypeMap: { [key: string]: string } = {
      'soc': 'SOC 3 Report',
      'soc 3': 'SOC 3 Report',
      'soc3': 'SOC 3 Report',
      'contract': 'Contract',
      'policy': 'Policy Document',
      'agreement': 'Agreement',
      'report': 'Report'
    };

    let documentType = 'Unknown';
    if (analysis.documentType) {
      const lowercaseType = analysis.documentType.toLowerCase();
      for (const [key, value] of Object.entries(documentTypeMap)) {
        if (lowercaseType.includes(key)) {
          documentType = value;
          break;
        }
      }
    }

    // Standardize industry values
    const industryMap: { [key: string]: string } = {
      'tech': 'TECHNOLOGY',
      'software': 'TECHNOLOGY',
      'digital': 'TECHNOLOGY',
      'health': 'HEALTHCARE',
      'medical': 'HEALTHCARE',
      'pharma': 'HEALTHCARE',
      'bank': 'FINANCIAL',
      'finance': 'FINANCIAL',
      'investment': 'FINANCIAL',
      'manufacturing': 'MANUFACTURING',
      'industrial': 'MANUFACTURING',
      'retail': 'RETAIL',
      'commerce': 'RETAIL'
    };

    let industry = 'TECHNOLOGY';
    if (analysis.industry) {
      const lowercaseIndustry = analysis.industry.toLowerCase();
      for (const [key, value] of Object.entries(industryMap)) {
        if (lowercaseIndustry.includes(key)) {
          industry = value;
          break;
        }
      }
    }

    return {
      documentType,
      industry,
      complianceStatus: analysis.complianceStatus || complianceStatus,
      complianceDetails: {
        score: analysis.confidence ? Math.round(analysis.confidence * 100) : 75,
        findings: Array.isArray(analysis.details?.findings) ? analysis.details.findings : []
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
        documentType: aiAnalysis.documentType || 'Unknown',
        industry: aiAnalysis.industry || 'TECHNOLOGY',
        complianceStatus: aiAnalysis.complianceStatus || 'Needs Review'
      }).returning();

      return {
        ...result,
        details: aiAnalysis.complianceDetails
      };
    } catch (error) {
      console.error("Document analysis failed:", error);
      // Don't throw, return a default analysis
      return {
        documentId,
        fileName: `Document_${documentId}.pdf`,
        fileDate: new Date().toISOString(),
        documentType: 'Unknown',
        industry: 'TECHNOLOGY',
        complianceStatus: 'Needs Review',
        details: {
          score: 50,
          findings: ['Analysis failed, please try again or review manually']
        }
      };
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