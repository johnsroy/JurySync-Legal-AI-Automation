import { db } from "../db";
import { DocumentMetadata, WorkflowResult, DocumentAnalysis } from "@shared/types";
import { vaultDocumentAnalysis } from "@shared/schema";
import { eq } from "drizzle-orm";
import { documentClassificationAgent } from "./documentClassificationAgent";

interface StageAnalysis {
  documentType: string;
  industry: string;
  complianceStatus: string;
  complianceDetails?: {
    score: number | null;
    findings: string[];
    scope: string | null;
    keyTerms: string[];
    recommendations: string[];
  };
}

export class DocumentAnalyticsService {
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

  async processWorkflowResults(workflowResults: WorkflowResult[]): Promise<DocumentAnalysis> {
    try {
      console.log('Processing workflow results:', workflowResults);

      const metadata: DocumentAnalysis = {
        documentType: '',
        industry: '',
        complianceStatus: 'PENDING',
        riskScore: 0,
        processedStages: [],
        lastUpdated: new Date()
      };

      for (const result of workflowResults) {
        metadata.processedStages.push({
          type: result.stageType,
          status: result.status || 'completed',
          content: result.content,
          timestamp: new Date()
        });

        if (result.riskScore) {
          metadata.riskScore = Math.max(metadata.riskScore, result.riskScore);
        }
      }

      return metadata;
    } catch (error) {
      console.error('Failed to process workflow results:', error);
      throw new Error('Workflow results processing failed');
    }
  }

  private async analyzeWithAI(content: string, stageResults?: WorkflowResult[]): Promise<StageAnalysis> {
    console.log('Starting enhanced document analysis with AI...');

    try {
      const classification = await documentClassificationAgent.classifyDocument(content);
      console.log('Initial classification result:', classification);

      // Map industry using standardized mapping
      let mappedIndustry = classification.metadata?.industry?.toUpperCase() || 'TECHNOLOGY';
      for (const [key, value] of Object.entries(this.industryMap)) {
        if (mappedIndustry.toLowerCase().includes(key)) {
          mappedIndustry = value;
          break;
        }
      }

      // For M&A documents, ensure consistent document type
      const documentType = classification.documentType.toLowerCase().includes('m&a') ? 
        'M&A Deal' : classification.documentType;

      return {
        documentType,
        industry: mappedIndustry,
        complianceStatus: classification.complianceStatus,
        complianceDetails: {
          score: Math.round((classification.confidence || 0) * 100),
          findings: classification.findings || [],
          scope: classification.metadata?.regulatoryFramework || null,
          keyTerms: classification.keyTerms || [],
          recommendations: classification.recommendations || []
        }
      };
    } catch (error) {
      console.error("Document analysis failed:", error);
      throw new Error("Failed to analyze document: " + (error instanceof Error ? error.message : String(error)));
    }
  }

  async analyzeDocument(documentId: number, content: string, workflowResults?: WorkflowResult[]): Promise<DocumentAnalysis> {
    try {
      console.log('Starting document analysis for ID:', documentId);
      const aiAnalysis = await this.analyzeWithAI(content, workflowResults);
      console.log('AI Analysis complete:', aiAnalysis);

      const analysis: DocumentAnalysis = {
        documentType: aiAnalysis.documentType,
        industry: aiAnalysis.industry,
        complianceStatus: aiAnalysis.complianceStatus,
        riskScore: aiAnalysis.complianceDetails?.score || 0,
        processedStages: [],
        lastUpdated: new Date()
      };

      // Insert into database
      const [result] = await db
        .insert(vaultDocumentAnalysis)
        .values({
          documentId,
          fileName: `Document_${documentId}.pdf`,
          fileDate: analysis.lastUpdated,
          documentType: analysis.documentType,
          industry: analysis.industry,
          complianceStatus: analysis.complianceStatus,
          metadata: {
            score: aiAnalysis.complianceDetails?.score,
            findings: aiAnalysis.complianceDetails?.findings,
            scope: aiAnalysis.complianceDetails?.scope,
            keyTerms: aiAnalysis.complianceDetails?.keyTerms,
            recommendations: aiAnalysis.complianceDetails?.recommendations
          }
        })
        .returning();

      return {
        ...analysis,
        id: result.id
      };
    } catch (error) {
      console.error("Document analysis failed:", error);
      throw error;
    }
  }

  async getDocumentAnalysis(documentId: number): Promise<DocumentAnalysis | null> {
    try {
      const results = await db
        .select()
        .from(vaultDocumentAnalysis)
        .where(eq(vaultDocumentAnalysis.documentId, documentId))
        .limit(1);

      const result = results[0];

      if (!result) return null;

      return {
        id: result.id,
        documentType: result.documentType,
        industry: result.industry,
        complianceStatus: result.complianceStatus,
        riskScore: result.metadata?.score || 0,
        processedStages: [],
        lastUpdated: result.fileDate
      };
    } catch (error) {
      console.error("Error fetching document analysis:", error);
      return null;
    }
  }
}

export const documentAnalyticsService = new DocumentAnalyticsService();