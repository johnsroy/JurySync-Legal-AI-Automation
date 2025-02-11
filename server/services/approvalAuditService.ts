import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// Initialize Anthropic client
// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Schema for approval analysis
const approvalAnalysisSchema = z.object({
  riskScore: z.number().min(0).max(100),
  approvalRecommendation: z.string(),
  keyFindings: z.array(z.object({
    category: z.string(),
    finding: z.string(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  })),
  legalCompliance: z.array(z.object({
    requirement: z.string(),
    status: z.enum(['COMPLIANT', 'NON_COMPLIANT', 'NEEDS_REVIEW']),
    details: z.string(),
  })),
});

// Schema for final audit
const auditReportSchema = z.object({
  documentIntegrity: z.object({
    score: z.number().min(0).max(100),
    issues: z.array(z.string()),
  }),
  complianceVerification: z.array(z.object({
    regulation: z.string(),
    status: z.string(),
    recommendations: z.array(z.string()),
  })),
  riskAssessment: z.object({
    overallRisk: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    categories: z.array(z.object({
      name: z.string(),
      riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
      details: z.string(),
    })),
  }),
  auditTrail: z.array(z.object({
    timestamp: z.string(),
    action: z.string(),
    details: z.string(),
  })),
});

export type ApprovalAnalysis = z.infer<typeof approvalAnalysisSchema>;
export type AuditReport = z.infer<typeof auditReportSchema>;

export class ApprovalAuditService {
  async performApprovalAnalysis(documentContent: string): Promise<ApprovalAnalysis> {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        messages: [{ 
          role: "user", 
          content: `Analyze this legal document for approval. Provide a detailed analysis in JSON format with:
          - Risk score (0-100)
          - Approval recommendation
          - Key findings (with categories and severity)
          - Legal compliance status

          Document content: ${documentContent}`
        }]
      });

      const analysisText = response.content[0].text;
      if (!analysisText) {
        throw new Error('No analysis content received from AI');
      }

      const analysis = JSON.parse(analysisText);
      return approvalAnalysisSchema.parse(analysis);
    } catch (error) {
      console.error('Approval analysis error:', error);
      throw new Error('Failed to perform approval analysis');
    }
  }

  async generateFinalAudit(documentContent: string, approvalHistory: any[]): Promise<AuditReport> {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        messages: [{ 
          role: "user", 
          content: `Generate a comprehensive final audit report in JSON format for this legal document with:
          - Document integrity (score and issues)
          - Compliance verification (regulations and status)
          - Risk assessment (overall risk and categories)
          - Audit trail

          Document content: ${documentContent}
          Approval history: ${JSON.stringify(approvalHistory)}`
        }]
      });

      const reportText = response.content[0].text;
      if (!reportText) {
        throw new Error('No report content received from AI');
      }

      const report = JSON.parse(reportText);
      return auditReportSchema.parse(report);
    } catch (error) {
      console.error('Final audit error:', error);
      throw new Error('Failed to generate final audit report');
    }
  }

  async getRiskScorecard(documentContent: string): Promise<{
    score: number;
    breakdown: Array<{ category: string; score: number; findings: string[] }>;
  }> {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{ 
          role: "user", 
          content: `Generate a risk scorecard for this legal document in JSON format with:
          - Overall score (0-100)
          - Breakdown by category

          Document content: ${documentContent}`
        }]
      });

      const scorecardText = response.content[0].text;
      if (!scorecardText) {
        throw new Error('No scorecard content received from AI');
      }

      return JSON.parse(scorecardText);
    } catch (error) {
      console.error('Risk scorecard error:', error);
      throw new Error('Failed to generate risk scorecard');
    }
  }
}

export const approvalAuditService = new ApprovalAuditService();