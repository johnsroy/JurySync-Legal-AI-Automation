import { openai } from './openai';
import { db } from "../db";
import { complianceDocuments } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Enhanced logging
function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ComplianceAudit] [${type.toUpperCase()}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
}

interface AnalysisProgress {
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  result?: any;
  error?: string;
}

const analysisProgress = new Map<number, AnalysisProgress>();

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

      // Initialize progress
      analysisProgress.set(documentId, {
        status: 'processing',
        progress: 0
      });

      // Update document status
      await db
        .update(complianceDocuments)
        .set({ status: 'PROCESSING' })
        .where(eq(complianceDocuments.id, documentId));

      // First stage: Initial Analysis (25%)
      analysisProgress.set(documentId, {
        status: 'processing',
        progress: 25
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a legal compliance expert. Analyze the provided document for compliance issues and provide a detailed JSON response with the following structure:
              {
                "analysis": {
                  "summary": "Brief overview of the document",
                  "issues": [
                    {
                      "severity": "high|medium|low",
                      "description": "Detailed description of the issue",
                      "recommendation": "Specific recommendation to address the issue"
                    }
                  ],
                  "riskScore": number between 0 and 100,
                  "complianceStatus": "COMPLIANT|NON_COMPLIANT|FLAGGED",
                  "recommendedActions": ["List of recommended actions"]
                }
              }`
          },
          {
            role: "user",
            content: `Analyze this document for compliance issues:\n\n${content}`
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      // Second stage: Detailed Analysis (75%)
      analysisProgress.set(documentId, {
        status: 'processing',
        progress: 75
      });

      const analysis = JSON.parse(response.choices[0].message.content);

      // Final stage: Store Results
      await db
        .update(complianceDocuments)
        .set({
          status: analysis.analysis.complianceStatus,
          riskScore: analysis.analysis.riskScore,
          lastScanned: new Date(),
          content: content
        })
        .where(eq(complianceDocuments.id, documentId));

      // Mark as completed
      analysisProgress.set(documentId, {
        status: 'completed',
        progress: 100,
        result: analysis
      });

      log('Document analysis completed', 'info', { documentId });

    } catch (error) {
      log('Document analysis failed', 'error', { documentId, error });

      analysisProgress.set(documentId, {
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Analysis failed'
      });

      await db
        .update(complianceDocuments)
        .set({ status: 'ERROR' })
        .where(eq(complianceDocuments.id, documentId));

      throw error;
    }
  }

  getAnalysisProgress(documentId: number): AnalysisProgress | undefined {
    return analysisProgress.get(documentId);
  }
}

export const complianceAuditService = ComplianceAuditService.getInstance();