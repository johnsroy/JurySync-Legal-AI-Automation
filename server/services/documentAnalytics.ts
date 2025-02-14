import { DocumentMetadata, WorkflowResult } from "@shared/types";
import { documentsCollection, analysisCollection, db } from "../firebase";
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
          findings: [],
          scope: classification.metadata?.regulatoryFramework || null,
          keyTerms: [],
          recommendations: []
        }
      };
    } catch (error) {
      console.error("Document analysis failed:", error);
      throw new Error("Failed to analyze document: " + (error instanceof Error ? error.message : String(error)));
    }
  }

  async analyzeDocument(documentId: string, content: string, workflowResults?: WorkflowResult[]): Promise<any> {
    try {
      console.log('Starting document analysis for ID:', documentId);
      const aiAnalysis = await this.analyzeWithAI(content, workflowResults);
      console.log('AI Analysis complete:', aiAnalysis);

      const analysisData = {
        documentId,
        fileName: `Document_${documentId}.pdf`,
        fileDate: new Date(),
        documentType: aiAnalysis.documentType,
        industry: aiAnalysis.industry,
        complianceStatus: aiAnalysis.complianceStatus,
        details: aiAnalysis.complianceDetails
      };

      await analysisCollection.doc(documentId).set(analysisData);
      console.log('Analysis stored in database:', analysisData);

      return analysisData;
    } catch (error) {
      console.error("Document analysis failed:", error);
      throw error;
    }
  }

  async getDocumentAnalysis(documentId: string): Promise<any> {
    try {
      const analysisDoc = await analysisCollection.doc(documentId).get();
      return analysisDoc.exists ? analysisDoc.data() : null;
    } catch (error) {
      console.error("Error fetching document analysis:", error);
      return null;
    }
  }
}

export const documentAnalyticsService = new DocumentAnalyticsService();