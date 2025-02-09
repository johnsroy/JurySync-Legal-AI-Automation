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
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a legal compliance expert. Analyze the provided document for compliance issues, regulatory deviations, ambiguous clauses, and potential risks."
          },
          {
            role: "user",
            content: `Analyze this legal document for compliance issues and provide a detailed report:

            Document Text: ${documentText}

            Focus on:
            1. Regulatory compliance deviations
            2. Ambiguous or unclear clauses
            3. Potential legal risks
            4. Standard regulatory language adherence

            Provide a thorough analysis with specific examples and references.`
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

      // Combine and aggregate results
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
        complianceScores: {
          openai: openAIAnalysis.complianceScore,
          anthropic: anthropicAnalysis.complianceScore,
          combined: {
            overall: Math.round((openAIAnalysis.complianceScore.overall + anthropicAnalysis.complianceScore.overall) / 2),
            regulatory: Math.round((openAIAnalysis.complianceScore.regulatory + anthropicAnalysis.complianceScore.regulatory) / 2),
            clarity: Math.round((openAIAnalysis.complianceScore.clarity + anthropicAnalysis.complianceScore.clarity) / 2),
            risk: Math.round((openAIAnalysis.complianceScore.risk + anthropicAnalysis.complianceScore.risk) / 2)
          }
        },
        metadata: {
          analyzedAt: new Date().toISOString(),
          models: {
            openai: "gpt-4o",
            anthropic: "claude-3-5-sonnet-20241022"
          }
        }
      };

      // Store document in ChromaDB
      const [document] = await db.insert(documents).values({
        title: `Compliance Audit - ${new Date().toISOString()}`,
        content: documentText,
        analysis: combinedReport,
        agentType: 'COMPLIANCE_AUDITING',
        userId: 1, // TODO: Replace with actual user ID from context
      }).returning();

      await chromaStore.addDocument(document, documentText);

      // Log the audit in PostgreSQL
      const regRefs = new Set<string>();
      openAIAnalysis.flaggedIssues.forEach((i: any) => {
        if (i.regulatoryReference) regRefs.add(i.regulatoryReference);
      });
      anthropicAnalysis.flaggedIssues.forEach((i: any) => {
        if (i.regulatoryReference) regRefs.add(i.regulatoryReference);
      });

      const [auditRecord] = await db.insert(complianceAudits).values({
        documentText,
        openaiResponse: openAIAnalysis,
        anthropicResponse: anthropicAnalysis,
        combinedReport,
        vectorId: document.id.toString(),
        metadata: {
          documentType: 'compliance_audit',
          confidence: combinedReport.complianceScores.combined.overall / 100,
          tags: Array.from(regRefs)
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