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

// Enhanced logging function
function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ComplianceAudit] [${type.toUpperCase()}] ${message}`, context ? context : '');
}

export class ComplianceAuditService {
  private static instance: ComplianceAuditService;

  private constructor() {}

  static getInstance(): ComplianceAuditService {
    if (!ComplianceAuditService.instance) {
      ComplianceAuditService.instance = new ComplianceAuditService();
    }
    return ComplianceAuditService.instance;
  }

  private async analyzeWithOpenAI(documentText: string) {
    try {
      log('Starting OpenAI analysis');
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a legal compliance expert. Analyze the provided document and return a detailed JSON response with compliance analysis, risk assessment, and visualization-ready metrics."
          },
          {
            role: "user",
            content: `Analyze this legal document and provide a detailed JSON report with the following structure:

            Document Text: ${documentText}

            Please format your response as JSON with these fields:
            {
              "summary": "comprehensive overview",
              "riskRating": number between 1-5,
              "flaggedIssues": [
                {
                  "id": "unique_id",
                  "title": "issue title",
                  "description": "detailed description",
                  "severity": "low|medium|high",
                  "category": "regulatory|clarity|risk",
                  "section": "relevant document section",
                  "impact": "potential impact",
                  "regulatoryReference": "specific regulation"
                }
              ],
              "recommendations": [
                {
                  "id": "unique_id",
                  "title": "action title",
                  "description": "detailed description",
                  "priority": "low|medium|high",
                  "implementationSteps": ["step1", "step2"],
                  "expectedOutcome": "description of outcome",
                  "timelineEstimate": "short|medium|long"
                }
              ],
              "visualizationData": {
                "riskDistribution": {
                  "low": number,
                  "medium": number,
                  "high": number
                },
                "complianceScore": {
                  "overall": number between 0-100,
                  "regulatory": number between 0-100,
                  "clarity": number between 0-100,
                  "risk": number between 0-100
                },
                "categoryBreakdown": [
                  {
                    "category": "string",
                    "count": number,
                    "severity": "low|medium|high"
                  }
                ]
              }
            }`
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      log('OpenAI analysis completed');
      return result;
    } catch (error: any) {
      log('OpenAI analysis failed', 'error', error);
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
          content: [
            {
              type: "text",
              text: `Analyze this legal document for compliance issues and provide a detailed report. 
              
              Document Text: ${documentText}
              
              Focus on:
              1. Regulatory compliance deviations
              2. Ambiguous or unclear clauses
              3. Potential legal risks
              4. Standard regulatory language adherence
              
              Format response as JSON with:
              {
                "summary": "comprehensive overview",
                "riskRating": number between 1-5,
                "flaggedIssues": [
                  {
                    "issue": "description",
                    "severity": "low|medium|high",
                    "section": "relevant section",
                    "impact": "potential impact",
                    "regulatoryReference": "specific regulation if applicable"
                  }
                ],
                "recommendations": [
                  {
                    "recommendation": "specific action",
                    "priority": "low|medium|high",
                    "rationale": "explanation",
                    "implementationSteps": ["step1", "step2"]
                  }
                ],
                "complianceScore": {
                  "overall": number between 0-100,
                  "regulatory": number between 0-100,
                  "clarity": number between 0-100,
                  "risk": number between 0-100
                }
              }`
            }
          ]
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Anthropic API');
      }

      const result = JSON.parse(content.text);
      log('Anthropic analysis completed');
      return result;
    } catch (error: any) {
      log('Anthropic analysis failed', 'error', error);
      throw new Error(`Anthropic analysis failed: ${error.message}`);
    }
  }

  async analyzeDocument(documentText: string) {
    try {
      log('Starting combined compliance analysis');

      // Run both analyses in parallel
      const [openAIAnalysis, anthropicAnalysis] = await Promise.all([
        this.analyzeWithOpenAI(documentText),
        this.analyzeWithAnthropic(documentText)
      ]);

      // Combine and aggregate results with enhanced visualization data
      const combinedReport = {
        summary: {
          openai: openAIAnalysis.summary,
          anthropic: anthropicAnalysis.summary
        },
        riskRating: Math.round((openAIAnalysis.riskRating + anthropicAnalysis.riskRating) / 2),
        flaggedIssues: [
          ...openAIAnalysis.flaggedIssues.map((issue: any) => ({
            ...issue,
            source: 'openai'
          })),
          ...anthropicAnalysis.flaggedIssues.map((issue: any) => ({
            ...issue,
            source: 'anthropic'
          }))
        ],
        recommendations: [
          ...openAIAnalysis.recommendations.map((rec: any) => ({
            ...rec,
            source: 'openai'
          })),
          ...anthropicAnalysis.recommendations.map((rec: any) => ({
            ...rec,
            source: 'anthropic'
          }))
        ],
        visualizationData: {
          riskDistribution: {
            low: openAIAnalysis.visualizationData.riskDistribution.low,
            medium: openAIAnalysis.visualizationData.riskDistribution.medium,
            high: openAIAnalysis.visualizationData.riskDistribution.high
          },
          complianceScores: {
            openai: openAIAnalysis.visualizationData.complianceScore,
            anthropic: anthropicAnalysis.complianceScore,
            combined: {
              overall: Math.round((openAIAnalysis.visualizationData.complianceScore.overall + 
                        anthropicAnalysis.complianceScore.overall) / 2),
              regulatory: Math.round((openAIAnalysis.visualizationData.complianceScore.regulatory + 
                          anthropicAnalysis.complianceScore.regulatory) / 2),
              clarity: Math.round((openAIAnalysis.visualizationData.complianceScore.clarity + 
                       anthropicAnalysis.complianceScore.clarity) / 2),
              risk: Math.round((openAIAnalysis.visualizationData.complianceScore.risk + 
                    anthropicAnalysis.complianceScore.risk) / 2)
            }
          },
          categoryBreakdown: openAIAnalysis.visualizationData.categoryBreakdown
        },
        metadata: {
          analyzedAt: new Date().toISOString(),
          models: {
            openai: "gpt-4o",
            anthropic: "claude-3-5-sonnet-20241022"
          }
        }
      };

      // Store results in database and vector store
      const [document] = await db.insert(documents).values({
        title: `Compliance Audit - ${new Date().toISOString()}`,
        content: documentText,
        analysis: combinedReport,
        agentType: 'COMPLIANCE_AUDITING',
        userId: 1, // TODO: Replace with actual user ID from context
      }).returning();

      await chromaStore.addDocument(document, documentText);

      // Log the audit
      const [auditRecord] = await db.insert(complianceAudits).values({
        documentText,
        openaiResponse: openAIAnalysis,
        anthropicResponse: anthropicAnalysis,
        combinedReport,
        vectorId: document.id.toString(),
        metadata: {
          documentType: 'compliance_audit',
          confidence: combinedReport.visualizationData.complianceScores.combined.overall / 100,
          tags: combinedReport.flaggedIssues.map(issue => issue.regulatoryReference).filter(Boolean)
        }
      }).returning();

      log('Combined analysis completed');
      return {
        ...combinedReport,
        auditId: auditRecord.id,
        vectorId: document.id
      };
    } catch (error: any) {
      log('Combined analysis failed', 'error', error);
      throw error;
    }
  }
}

export const complianceAuditService = ComplianceAuditService.getInstance();