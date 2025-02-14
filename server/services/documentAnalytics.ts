import { db } from "../db";
import { DocumentMetadata, WorkflowResult } from "@shared/types";
import { vaultDocumentAnalysis } from "@shared/schema";
import { eq } from "drizzle-orm";
import { openai } from "../openai";
import { anthropic } from "../anthropic";
import { documentClassificationAgent } from "./documentClassificationAgent";

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
  // Map to standardize industry classifications
  private industryMap: { [key: string]: string } = {
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

  private async analyzeWithAI(content: string, stageResults?: WorkflowResult[]): Promise<StageAnalysis> {
    const maxLength = 8000;
    const truncatedContent = content.length > maxLength ?
      content.slice(0, maxLength) + "..." :
      content;

    try {
      // First attempt classification with the specialized agent
      const classification = await documentClassificationAgent.classifyDocument(truncatedContent);
      console.log('Initial classification:', classification);

      // Refine the classification with additional mapping
      const refinedClassification = documentClassificationAgent.refineClassification(classification);
      console.log('Refined classification:', refinedClassification);

      // Map the industry using our standardized mapping
      let mappedIndustry = refinedClassification.metadata?.industry?.toUpperCase() || 'TECHNOLOGY';
      for (const [key, value] of Object.entries(this.industryMap)) {
        if (mappedIndustry.toLowerCase().includes(key)) {
          mappedIndustry = value;
          break;
        }
      }

      // Validate compliance status
      const validComplianceStatuses = ['Compliant', 'Non-Compliant', 'Needs Review'];
      const complianceStatus = validComplianceStatuses.includes(refinedClassification.complianceStatus || '')
        ? refinedClassification.complianceStatus
        : 'Needs Review';

      return {
        documentType: refinedClassification.documentType,
        industry: mappedIndustry,
        complianceStatus,
        complianceDetails: {
          score: Math.round((refinedClassification.confidence || 0) * 100),
          findings: [],
          scope: refinedClassification.metadata?.regulatoryFramework || null,
          keyTerms: [],
          recommendations: []
        }
      };

    } catch (error) {
      console.error("Document analysis failed:", error);
      throw new Error("Failed to analyze document: " + (error instanceof Error ? error.message : String(error)));
    }
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