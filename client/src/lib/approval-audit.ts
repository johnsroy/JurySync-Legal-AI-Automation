import { apiRequest } from "./queryClient";

interface KeyFinding {
  category: string;
  finding: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface ComplianceStatus {
  requirement: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
  details: string;
}

interface ApprovalAnalysis {
  riskScore: number;
  approvalRecommendation: string;
  keyFindings: KeyFinding[];
  legalCompliance: ComplianceStatus[];
}

interface AuditReport {
  documentIntegrity: {
    score: number;
    issues: string[];
  };
  complianceVerification: Array<{
    regulation: string;
    status: string;
    recommendations: string[];
  }>;
  riskAssessment: {
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    categories: Array<{
      name: string;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
      details: string;
    }>;
  };
  auditTrail: Array<{
    timestamp: string;
    action: string;
    details: string;
  }>;
}

class ApprovalAuditService {
  async performApprovalAnalysis(documentContent: string): Promise<ApprovalAnalysis> {
    try {
      const response = await apiRequest('POST', '/api/workflow/approval-analysis', {
        documentContent
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to perform approval analysis:', error);
      throw new Error('Failed to perform approval analysis');
    }
  }

  async generateFinalAudit(documentContent: string, workflowHistory: any): Promise<AuditReport> {
    try {
      const response = await apiRequest('POST', '/api/workflow/final-audit', {
        documentContent,
        workflowHistory
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to generate final audit:', error);
      throw new Error('Failed to generate final audit report');
    }
  }

  async getRiskScorecard(documentContent: string): Promise<{
    score: number;
    breakdown: Array<{
      category: string;
      score: number;
      findings: string[];
    }>;
  }> {
    try {
      const response = await apiRequest('POST', '/api/workflow/risk-scorecard', {
        documentContent
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to generate risk scorecard:', error);
      throw new Error('Failed to generate risk scorecard');
    }
  }
}

export const approvalAuditService = new ApprovalAuditService();
