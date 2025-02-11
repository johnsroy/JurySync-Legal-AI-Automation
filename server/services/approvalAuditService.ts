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
      console.log('Starting approval analysis...');

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        system: `You are a legal document analyzer. Analyze legal documents and provide detailed analysis in a strictly formatted JSON output.

Format your response as a JSON object with these exact fields:
{
  "riskScore": <number between 0-100>,
  "approvalRecommendation": "<clear guidance on whether to approve>",
  "keyFindings": [
    {
      "category": "<area of concern>",
      "finding": "<detailed observation>",
      "severity": "<LOW|MEDIUM|HIGH>"
    }
  ],
  "legalCompliance": [
    {
      "requirement": "<specific legal requirement>",
      "status": "<COMPLIANT|NON_COMPLIANT|NEEDS_REVIEW>",
      "details": "<explanation of compliance status>"
    }
  ]
}`,
        messages: [{ 
          role: "user", 
          content: `Analyze this legal document and provide a comprehensive analysis in the specified JSON format:

Document content: ${documentContent}`
        }]
      });

      console.log('Received response from Anthropic');

      // Get the first content block's text
      const content = response.content[0];
      if (!content || !('text' in content)) {
        throw new Error('Invalid response format from AI');
      }

      const analysisText = content.text;
      console.log('Parsing analysis text...');

      try {
        const analysis = JSON.parse(analysisText);
        console.log('Successfully parsed JSON response');

        // Validate with Zod schema
        return approvalAnalysisSchema.parse(analysis);
      } catch (parseError) {
        console.error('Error parsing approval analysis:', parseError);
        throw new Error('Failed to parse AI response: ' + (parseError instanceof Error ? parseError.message : String(parseError)));
      }
    } catch (error) {
      console.error('Approval analysis error:', error);
      throw new Error('Failed to perform approval analysis: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async generateFinalAudit(documentContent: string, approvalHistory: any[]): Promise<AuditReport> {
    try {
      console.log('Starting final audit generation...');

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        messages: [{ 
          role: "user", 
          content: `Generate a comprehensive final audit report in JSON format for this legal document with the following structure:
{
  "documentIntegrity": {
    "score": <number 0-100>,
    "issues": [<string>]
  },
  "complianceVerification": [{
    "regulation": "<string>",
    "status": "<string>",
    "recommendations": ["<string>"]
  }],
  "riskAssessment": {
    "overallRisk": "<LOW|MEDIUM|HIGH>",
    "categories": [{
      "name": "<string>",
      "riskLevel": "<LOW|MEDIUM|HIGH>",
      "details": "<string>"
    }]
  },
  "auditTrail": [{
    "timestamp": "<ISO string>",
    "action": "<string>",
    "details": "<string>"
  }]
}

Document content: ${documentContent}
Approval history: ${JSON.stringify(approvalHistory)}`
        }]
      });

      const content = response.content[0];
      if (!content || !('text' in content)) {
        throw new Error('Invalid response format from AI');
      }

      const reportText = content.text;
      console.log('Parsing audit report...');

      try {
        const report = JSON.parse(reportText);
        console.log('Successfully parsed JSON response');

        return auditReportSchema.parse(report);
      } catch (parseError) {
        console.error('Error parsing audit report:', parseError);
        throw new Error('Failed to parse AI response: ' + (parseError instanceof Error ? parseError.message : String(parseError)));
      }
    } catch (error) {
      console.error('Final audit error:', error);
      throw new Error('Failed to generate final audit report: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async getRiskScorecard(documentContent: string): Promise<{
    score: number;
    breakdown: Array<{ category: string; score: number; findings: string[] }>;
  }> {
    try {
      console.log('Starting risk scorecard generation...');

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{ 
          role: "user", 
          content: `Generate a risk scorecard in JSON format with this structure:
{
  "score": <number 0-100>,
  "breakdown": [{
    "category": "<string>",
    "score": <number 0-100>,
    "findings": ["<string>"]
  }]
}

Document content: ${documentContent}`
        }]
      });

      const content = response.content[0];
      if (!content || !('text' in content)) {
        throw new Error('Invalid response format from AI');
      }

      const scorecardText = content.text;
      console.log('Parsing risk scorecard...');

      try {
        return JSON.parse(scorecardText);
      } catch (parseError) {
        console.error('Error parsing risk scorecard:', parseError);
        throw new Error('Failed to parse AI response: ' + (parseError instanceof Error ? parseError.message : String(parseError)));
      }
    } catch (error) {
      console.error('Risk scorecard error:', error);
      throw new Error('Failed to generate risk scorecard: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
}

export const approvalAuditService = new ApprovalAuditService();