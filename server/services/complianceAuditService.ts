import OpenAI from "openai";
import { db } from "../db";
import { complianceDocuments, complianceIssues } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

// Enhanced logging
function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ComplianceAudit] [${type.toUpperCase()}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.");
}

const openai = new OpenAI();

interface AnalysisResult {
  analysis: {
    summary: string;
    issues: Array<{
      severity: 'high' | 'medium' | 'low';
      description: string;
      recommendation: string;
    }>;
    riskScore: number;
    complianceStatus: "COMPLIANT" | "NON_COMPLIANT" | "FLAGGED";
    recommendedActions: string[];
  };
  legalResearch?: {
    references: Array<{
      title: string;
      url: string;
      relevance: number;
      description: string;
    }>;
    summary: string;
    recommendations: string[];
  };
}

export class ComplianceAuditService {
  private static instance: ComplianceAuditService;

  private constructor() {
    log('Initializing ComplianceAuditService');
  }

  static getInstance(): ComplianceAuditService {
    if (!ComplianceAuditService.instance) {
      ComplianceAuditService.instance = new ComplianceAuditService();
    }
    return ComplianceAuditService.instance;
  }

  async analyzeDocument(documentId: number, content: string): Promise<void> {
    try {
      log('Starting document analysis', 'info', { documentId });

      // Update document status to processing
      await db
        .update(complianceDocuments)
        .set({ status: 'PROCESSING' })
        .where(eq(complianceDocuments.id, documentId));

      // Perform the analysis using OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a legal compliance expert and researcher. Analyze the provided document and respond with a JSON object that includes both compliance analysis and relevant legal research. Include the following:

1. Compliance Analysis:
- Document summary
- Specific compliance issues
- Risk assessment
- Recommended actions

2. Legal Research:
- Relevant legal precedents
- Applicable regulations
- Additional resources
- Expert recommendations

Respond in this format:
{
  "analysis": {
    "summary": "Concise document summary",
    "issues": [
      {
        "severity": "high|medium|low",
        "description": "Issue description",
        "recommendation": "Action to resolve"
      }
    ],
    "riskScore": <number between 0 and 100>,
    "complianceStatus": "COMPLIANT|NON_COMPLIANT|FLAGGED",
    "recommendedActions": ["Action 1", "Action 2"]
  },
  "legalResearch": {
    "references": [
      {
        "title": "Reference title",
        "url": "Reference URL",
        "relevance": <number between 0 and 1>,
        "description": "Brief description of relevance"
      }
    ],
    "summary": "Research summary",
    "recommendations": ["Recommendation 1", "Recommendation 2"]
  }
}`
          },
          {
            role: "user",
            content: content
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      if (!response.choices[0].message.content) {
        throw new Error("No content in OpenAI response");
      }

      let analysisResult: AnalysisResult;
      try {
        analysisResult = JSON.parse(response.choices[0].message.content);
        log('Successfully parsed OpenAI response', 'debug', { analysisResult });
      } catch (parseError) {
        log('Failed to parse OpenAI response', 'error', { 
          response: response.choices[0].message.content,
          error: parseError 
        });
        throw new Error("Failed to parse analysis results");
      }

      // Store results in database
      await db.transaction(async (tx) => {
        // Update document status and risk score
        await tx
          .update(complianceDocuments)
          .set({
            status: analysisResult.analysis.complianceStatus,
            riskScore: analysisResult.analysis.riskScore,
            lastScanned: new Date(),
            content: content,
            auditSummary: analysisResult.analysis.summary
          })
          .where(eq(complianceDocuments.id, documentId));

        // Store compliance issues
        const issueInserts = analysisResult.analysis.issues.map(issue => ({
          documentId,
          severity: issue.severity.toUpperCase() as "HIGH" | "MEDIUM" | "LOW",
          description: issue.description,
          recommendation: issue.recommendation,
          status: "OPEN",
          clause: 'General',
          riskAssessmentId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }));

        if (issueInserts.length > 0) {
          await tx.insert(complianceIssues).values(issueInserts);
        }
      });

      log('Document analysis completed', 'info', { documentId });

    } catch (error) {
      log('Document analysis failed', 'error', { documentId, error });

      await db
        .update(complianceDocuments)
        .set({ status: 'ERROR' })
        .where(eq(complianceDocuments.id, documentId));

      throw error;
    }
  }

  async getAnalysisProgress(documentId: number): Promise<{
    status: string;
    progress: number;
    result?: any;
    error?: string;
  }> {
    const [document] = await db
      .select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.id, documentId));

    if (!document) {
      return {
        status: 'error',
        progress: 0,
        error: 'Document not found'
      };
    }

    switch (document.status) {
      case 'PROCESSING':
        return {
          status: 'processing',
          progress: 50
        };
      case 'ERROR':
        return {
          status: 'error',
          progress: 0,
          error: 'Analysis failed'
        };
      case 'COMPLIANT':
      case 'NON_COMPLIANT':
      case 'FLAGGED':
        return {
          status: 'completed',
          progress: 100,
          result: {
            status: document.status,
            riskScore: document.riskScore,
            lastScanned: document.lastScanned,
            summary: document.auditSummary
          }
        };
      default:
        return {
          status: 'pending',
          progress: 0
        };
    }
  }
}

export const complianceAuditService = ComplianceAuditService.getInstance();