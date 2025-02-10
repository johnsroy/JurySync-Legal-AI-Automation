import { OpenAI } from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { db } from '../db';
import { complianceAudits, documents } from '@shared/schema';
import { chromaStore } from './chromaStore';

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("Missing ANTHROPIC_API_KEY environment variable");
}

// Initialize AI clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Enhanced logging function with more context
function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ComplianceAudit] [${type.toUpperCase()}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
}

// Retry logic for API calls
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      log(`Operation failed, attempt ${i + 1} of ${maxRetries}`, 'error', { error: error.message });
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

export class ComplianceAuditService {
  private static instance: ComplianceAuditService;

  private constructor() {
    log('Initializing ComplianceAuditService', 'info');
  }

  static getInstance(): ComplianceAuditService {
    if (!ComplianceAuditService.instance) {
      ComplianceAuditService.instance = new ComplianceAuditService();
    }
    return ComplianceAuditService.instance;
  }

  private async analyzeWithOpenAI(documentText: string) {
    return retryOperation(async () => {
      try {
        log('Starting OpenAI analysis');

        // Set a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('OpenAI analysis timeout')), 30000);
        });

        // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        const analysisPromise = openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a legal compliance expert. Analyze the provided document and return a detailed JSON response with comprehensive compliance analysis, risk assessment, and visualization-ready metrics."
            },
            {
              role: "user",
              content: `Analyze this legal document thoroughly and provide a detailed JSON report. Consider regulatory compliance, risk assessment, and visualization data.

              Document Text: ${documentText}

              Please format your response as JSON with this exact structure:
              {
                "auditReport": {
                  "summary": "comprehensive analysis overview",
                  "flaggedIssues": [
                    {
                      "issue": "detailed description of the issue",
                      "riskScore": number between 1 and 10,
                      "severity": "low|medium|high",
                      "section": "document section reference",
                      "recommendation": "specific action to resolve",
                      "regulatoryReference": "applicable regulation or standard",
                      "impact": "potential consequences"
                    }
                  ],
                  "riskScores": {
                    "average": number between 1 and 10,
                    "max": number between 1 and 10,
                    "min": number between 1 and 10,
                    "distribution": {
                      "high": number,
                      "medium": number,
                      "low": number
                    }
                  },
                  "recommendedActions": [
                    {
                      "action": "specific recommendation",
                      "priority": "high|medium|low",
                      "timeline": "immediate|short-term|long-term",
                      "impact": "expected outcome"
                    }
                  ],
                  "visualizationData": {
                    "issueFrequency": [number array representing issue count by category],
                    "riskTrend": [number array representing risk scores across document sections],
                    "complianceScores": {
                      "overall": number between 0 and 100,
                      "regulatory": number between 0 and 100,
                      "clarity": number between 0 and 100,
                      "risk": number between 0 and 100
                    }
                  }
                }
              }`
            }
          ],
          response_format: { type: "json_object" }
        });

        // Race between timeout and API call
        const response = await Promise.race([analysisPromise, timeoutPromise]);
        const result = JSON.parse(response.choices[0].message.content || "{}");
        log('OpenAI analysis completed successfully', 'info', { responseStructure: Object.keys(result) });
        return result;
      } catch (error: any) {
        log('OpenAI analysis failed', 'error', {
          error: error.message,
          stack: error.stack,
          response: error.response?.data
        });
        throw error;
      }
    });
  }

  private async analyzeWithAnthropic(documentText: string) {
    return retryOperation(async () => {
      try {
        log('Starting Anthropic analysis');

        // Set a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Anthropic analysis timeout')), 30000);
        });

        // the newest Anthropic model is "claude-3-5-sonnet-20241022"
        const analysisPromise = anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1500,
          messages: [{
            role: "user",
            content: `Analyze this legal document thoroughly for compliance issues and provide a detailed JSON report.

            Document Text: ${documentText}

            Format your response as JSON with this exact structure:
            {
              "auditReport": {
                "summary": "comprehensive analysis overview",
                "flaggedIssues": [
                  {
                    "issue": "detailed description of the issue",
                    "riskScore": number between 1 and 10,
                    "severity": "low|medium|high",
                    "section": "document section reference",
                    "recommendation": "specific action to resolve",
                    "regulatoryReference": "applicable regulation or standard",
                    "impact": "potential consequences"
                  }
                ],
                "riskScores": {
                  "average": number between 1 and 10,
                  "max": number between 1 and 10,
                  "min": number between 1 and 10,
                  "distribution": {
                    "high": number,
                    "medium": number,
                    "low": number
                  }
                },
                "recommendedActions": [
                  {
                    "action": "specific recommendation",
                    "priority": "high|medium|low",
                    "timeline": "immediate|short-term|long-term",
                    "impact": "expected outcome"
                  }
                ],
                "visualizationData": {
                  "issueFrequency": [number array representing issue count by category],
                  "riskTrend": [number array representing risk scores across document sections],
                  "complianceScores": {
                    "overall": number between 0 and 100,
                    "regulatory": number between 0 and 100,
                    "clarity": number between 0 and 100,
                    "risk": number between 0 and 100
                  }
                }
              }
            }`
          }]
        });

        // Race between timeout and API call
        const response = await Promise.race([analysisPromise, timeoutPromise]);
        const content = response.content[0];
        if (content.type !== 'text') {
          throw new Error('Unexpected response format from Anthropic API');
        }

        const result = JSON.parse(content.text);
        log('Anthropic analysis completed successfully', 'info', { responseStructure: Object.keys(result) });
        return result;
      } catch (error: any) {
        log('Anthropic analysis failed', 'error', {
          error: error.message,
          stack: error.stack,
          response: error.response?.data
        });
        throw error;
      }
    });
  }

  async analyzeDocument(documentText: string) {
    try {
      log('Starting combined compliance analysis');

      // Add detailed logging for API calls
      log('Verifying API configurations', 'debug', {
        openaiConfigured: !!process.env.OPENAI_API_KEY,
        anthropicConfigured: !!process.env.ANTHROPIC_API_KEY
      });

      // Run both analyses with individual timeouts and retries
      const [openAIAnalysis, anthropicAnalysis] = await Promise.allSettled([
        this.analyzeWithOpenAI(documentText),
        this.analyzeWithAnthropic(documentText)
      ]);

      // Log analysis results
      log('Analysis results', 'debug', {
        openAIStatus: openAIAnalysis.status,
        anthropicStatus: anthropicAnalysis.status
      });

      // Check results and handle failures
      const openAIResult = openAIAnalysis.status === 'fulfilled' ? openAIAnalysis.value : null;
      const anthropicResult = anthropicAnalysis.status === 'fulfilled' ? anthropicAnalysis.value : null;

      if (!openAIResult && !anthropicResult) {
        const error = new Error('Both AI analyses failed');
        log('Complete analysis failure', 'error', {
          openAIError: openAIAnalysis.status === 'rejected' ? openAIAnalysis.reason : null,
          anthropicError: anthropicAnalysis.status === 'rejected' ? anthropicAnalysis.reason : null
        });
        throw error;
      }

      try {
        // Create document record
        const [document] = await db.insert(documents).values({
          title: `Compliance Audit - ${new Date().toISOString()}`,
          content: documentText,
          analysis: { openAIAnalysis: openAIResult, anthropicAnalysis: anthropicResult },
          agentType: 'COMPLIANCE_AUDITING',
          userId: 1, // TODO: Replace with actual user ID from context
        }).returning();

        log('Document created in database', 'info', { documentId: document.id });

        // Skip ChromaDB for now as it's failing
        log('Skipping ChromaDB storage due to connection issues', 'info');

        // Use the first successful analysis as primary and fall back as needed
        const primaryAnalysis = openAIResult || anthropicResult;
        const secondaryAnalysis = openAIResult ? anthropicResult : null;

        // Combine and aggregate results
        const combinedReport = {
          auditReport: {
            summary: primaryAnalysis.auditReport.summary,
            flaggedIssues: [
              ...(openAIResult?.auditReport.flaggedIssues || []).map((issue: any) => ({
                ...issue,
                source: 'openai'
              })),
              ...(anthropicResult?.auditReport.flaggedIssues || []).map((issue: any) => ({
                ...issue,
                source: 'anthropic'
              }))
            ],
            riskScores: secondaryAnalysis ? {
              average: (primaryAnalysis.auditReport.riskScores.average + 
                      secondaryAnalysis.auditReport.riskScores.average) / 2,
              max: Math.max(primaryAnalysis.auditReport.riskScores.max,
                          secondaryAnalysis.auditReport.riskScores.max),
              min: Math.min(primaryAnalysis.auditReport.riskScores.min,
                          secondaryAnalysis.auditReport.riskScores.min),
              distribution: {
                high: Math.round((primaryAnalysis.auditReport.riskScores.distribution.high +
                              secondaryAnalysis.auditReport.riskScores.distribution.high) / 2),
                medium: Math.round((primaryAnalysis.auditReport.riskScores.distribution.medium +
                                secondaryAnalysis.auditReport.riskScores.distribution.medium) / 2),
                low: Math.round((primaryAnalysis.auditReport.riskScores.distribution.low +
                             secondaryAnalysis.auditReport.riskScores.distribution.low) / 2)
              }
            } : primaryAnalysis.auditReport.riskScores,
            recommendedActions: [
              ...(openAIResult?.auditReport.recommendedActions || []).map((action: any) => ({
                ...action,
                source: 'openai'
              })),
              ...(anthropicResult?.auditReport.recommendedActions || []).map((action: any) => ({
                ...action,
                source: 'anthropic'
              }))
            ],
            visualizationData: secondaryAnalysis ? {
              issueFrequency: primaryAnalysis.auditReport.visualizationData.issueFrequency,
              riskTrend: primaryAnalysis.auditReport.visualizationData.riskTrend,
              complianceScores: {
                overall: Math.round((primaryAnalysis.auditReport.visualizationData.complianceScores.overall +
                          secondaryAnalysis.auditReport.visualizationData.complianceScores.overall) / 2),
                regulatory: Math.round((primaryAnalysis.auditReport.visualizationData.complianceScores.regulatory +
                           secondaryAnalysis.auditReport.visualizationData.complianceScores.regulatory) / 2),
                clarity: Math.round((primaryAnalysis.auditReport.visualizationData.complianceScores.clarity +
                        secondaryAnalysis.auditReport.visualizationData.complianceScores.clarity) / 2),
                risk: Math.round((primaryAnalysis.auditReport.visualizationData.complianceScores.risk +
                     secondaryAnalysis.auditReport.visualizationData.complianceScores.risk) / 2)
              }
            } : primaryAnalysis.auditReport.visualizationData
          }
        };

        // Log the audit with correct column names
        const [auditRecord] = await db.insert(complianceAudits).values({
          documentText: documentText,
          openaiResponse: openAIResult,
          anthropicResponse: anthropicResult,
          combinedReport: combinedReport,
          vectorId: document.id.toString(),
          metadata: {
            documentType: 'compliance_audit',
            confidence: combinedReport.auditReport.visualizationData.complianceScores.overall / 100,
            tags: combinedReport.auditReport.flaggedIssues.map(issue => issue.regulatoryReference).filter(Boolean)
          }
        }).returning();

        log('Combined analysis completed', 'info', {
          auditId: auditRecord.id,
          documentId: document.id,
          issuesCount: combinedReport.auditReport.flaggedIssues.length,
          completionTime: new Date().toISOString()
        });

        return combinedReport;
      } catch (dbError: any) {
        log('Database operation failed', 'error', {
          error: dbError.message,
          stack: dbError.stack
        });
        throw dbError;
      }
    } catch (error: any) {
      log('Combined analysis failed', 'error', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

export const complianceAuditService = ComplianceAuditService.getInstance();