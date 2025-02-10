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
    try {
      log('Starting OpenAI analysis');
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      const response = await openai.chat.completions.create({
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

      const result = JSON.parse(response.choices[0].message.content || "{}");
      log('OpenAI analysis completed successfully', 'info', { responseStructure: Object.keys(result) });
      return result;
    } catch (error: any) {
      log('OpenAI analysis failed', 'error', {
        error: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      throw new Error(`OpenAI analysis failed: ${error.message}`);
    }
  }

  private async analyzeWithAnthropic(documentText: string) {
    try {
      log('Starting Anthropic analysis');
      // the newest Anthropic model is "claude-3-5-sonnet-20241022"
      const response = await anthropic.messages.create({
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
      throw new Error(`Anthropic analysis failed: ${error.message}`);
    }
  }

  async analyzeDocument(documentText: string) {
    try {
      log('Starting combined compliance analysis');

      // Run both analyses in parallel
      const [openAIAnalysis, anthropicAnalysis] = await Promise.all([
        this.analyzeWithOpenAI(documentText).catch(error => {
          log('OpenAI analysis failed, continuing with Anthropic only', 'error', error);
          return null;
        }),
        this.analyzeWithAnthropic(documentText).catch(error => {
          log('Anthropic analysis failed, continuing with OpenAI only', 'error', error);
          return null;
        })
      ]);

      if (!openAIAnalysis && !anthropicAnalysis) {
        throw new Error('Both AI analyses failed');
      }

      // Create document record
      const [document] = await db.insert(documents).values({
        title: `Compliance Audit - ${new Date().toISOString()}`,
        content: documentText,
        analysis: { openAIAnalysis, anthropicAnalysis },
        agentType: 'COMPLIANCE_AUDITING',
        userId: 1, // TODO: Replace with actual user ID from context
      }).returning();

      log('Document created in database', 'info', { documentId: document.id });

      // Try to store in vector database, but don't block if it fails
      try {
        await chromaStore.addDocument(document, documentText);
        log('Document added to vector store', 'info', { documentId: document.id });
      } catch (error) {
        log('Vector storage failed but continuing with analysis', 'error', error);
      }

      // Use the first successful analysis as primary and fall back as needed
      const primaryAnalysis = openAIAnalysis || anthropicAnalysis;
      const secondaryAnalysis = openAIAnalysis ? anthropicAnalysis : null;

      // Combine and aggregate results
      const combinedReport = {
        auditReport: {
          summary: primaryAnalysis.auditReport.summary,
          flaggedIssues: [
            ...(openAIAnalysis?.auditReport.flaggedIssues || []).map((issue: any) => ({
              ...issue,
              source: 'openai'
            })),
            ...(anthropicAnalysis?.auditReport.flaggedIssues || []).map((issue: any) => ({
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
            ...(openAIAnalysis?.auditReport.recommendedActions || []).map((action: any) => ({
              ...action,
              source: 'openai'
            })),
            ...(anthropicAnalysis?.auditReport.recommendedActions || []).map((action: any) => ({
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
        openaiResponse: openAIAnalysis,
        anthropicResponse: anthropicAnalysis,
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
        issuesCount: combinedReport.auditReport.flaggedIssues.length
      });

      return combinedReport;
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