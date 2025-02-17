import { db } from "../db";
import { reports, analyticsData } from "@shared/schema/reports";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import PDFDocument from 'pdfkit';
import { ComplianceResult } from "../types/compliance";
import { DeepResearchResult } from "./gemini";

interface ReportConfig {
  filters?: Record<string, any>;
  sections?: string[];
  customFields?: Record<string, any>;
  branding?: {
    logo?: string;
    primaryColor?: string;
    companyName?: string;
  };
}

interface ReportData {
  summary?: Record<string, any>;
  charts?: Record<string, any>[];
  tables?: Record<string, any>[];
}

export async function generateCompliancePDF(
  result: ComplianceResult,
  config: ReportConfig = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: 'Compliance Audit Report',
          Author: config.branding?.companyName || 'JurySync.io',
          Subject: 'Legal Compliance Analysis',
          Keywords: 'compliance, legal, audit, analysis',
          CreationDate: new Date(),
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc
        .fontSize(24)
        .text('Compliance Audit Report', { align: 'center' })
        .moveDown()
        .fontSize(12)
        .text(`Generated on: ${format(new Date(), 'PPP')}`, { align: 'center' })
        .moveDown(2);

      // Executive Summary
      doc
        .fontSize(16)
        .text('Executive Summary', { underline: true })
        .moveDown()
        .fontSize(12)
        .text(result.summary)
        .moveDown(2);

      // Risk Analysis
      doc
        .fontSize(16)
        .text('Risk Analysis', { underline: true })
        .moveDown()
        .fontSize(12)
        .text(`Overall Risk Level: ${result.riskLevel}`)
        .text(`Risk Score: ${result.score}/10`)
        .moveDown();

      // Risk Distribution
      doc.text('Risk Distribution:', { continued: true })
        .moveDown();
      const risks = ['High', 'Medium', 'Low'];
      risks.forEach(risk => {
        const count = result.riskScores.distribution[risk.toLowerCase()];
        const percentage = (count / (
          result.riskScores.distribution.high +
          result.riskScores.distribution.medium +
          result.riskScores.distribution.low
        ) * 100).toFixed(1);
        doc.text(`${risk} Risk Issues: ${count} (${percentage}%)`);
      });
      doc.moveDown(2);

      // Flagged Issues
      doc
        .fontSize(16)
        .text('Flagged Issues', { underline: true })
        .moveDown();

      result.issues.forEach((issue, index) => {
        doc
          .fontSize(14)
          .text(`Issue ${index + 1}: ${issue.clause}`)
          .fontSize(12)
          .text(`Severity: ${issue.severity}`)
          .text(`Description: ${issue.description}`)
          .text(`Recommendation: ${issue.recommendation}`)
          .moveDown();
      });

      // Recommended Actions
      doc
        .fontSize(16)
        .text('Recommended Actions', { underline: true })
        .moveDown();

      result.recommendedActions.forEach((action, index) => {
        doc
          .fontSize(12)
          .text(`${index + 1}. ${action.action}`)
          .text(`   Impact: ${action.impact}`)
          .moveDown();
      });

      // Footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(10)
          .text(
            `Page ${i + 1} of ${pageCount}`,
            doc.page.margins.left,
            doc.page.height - doc.page.margins.bottom - 20,
            { align: 'center' }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function generateLegalResearchPDF(
  result: DeepResearchResult,
  config: ReportConfig = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: 'Legal Research Report',
          Author: config.branding?.companyName || 'JurySync.io',
          Subject: 'Legal Research Analysis',
          Keywords: 'legal research, analysis, precedents',
          CreationDate: new Date(),
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc
        .fontSize(24)
        .text('Legal Research Report', { align: 'center' })
        .moveDown()
        .fontSize(12)
        .text(`Generated on: ${format(new Date(), 'PPP')}`, { align: 'center' })
        .moveDown(2);

      // Summary
      doc
        .fontSize(16)
        .text('Executive Summary', { underline: true })
        .moveDown()
        .fontSize(12)
        .text(result.summary)
        .moveDown(2);

      // Legal Principles
      doc
        .fontSize(16)
        .text('Key Legal Principles', { underline: true })
        .moveDown();

      result.analysis.legalPrinciples.forEach((principle, index) => {
        doc
          .fontSize(12)
          .text(`${index + 1}. ${principle}`)
          .moveDown();
      });
      doc.moveDown();

      // Key Precedents
      doc
        .fontSize(16)
        .text('Relevant Precedents', { underline: true })
        .moveDown();

      result.analysis.keyPrecedents.forEach((precedent, index) => {
        doc
          .fontSize(14)
          .text(precedent.case)
          .fontSize(12)
          .text(`Relevance: ${precedent.relevance}`)
          .text(`Impact: ${precedent.impact}`)
          .moveDown();
      });
      doc.moveDown();

      // Recommendations
      doc
        .fontSize(16)
        .text('Recommendations', { underline: true })
        .moveDown();

      result.analysis.recommendations.forEach((recommendation, index) => {
        doc
          .fontSize(12)
          .text(`${index + 1}. ${recommendation}`)
          .moveDown();
      });
      doc.moveDown();

      // Citations
      doc
        .fontSize(16)
        .text('Citations and References', { underline: true })
        .moveDown();

      result.citations.forEach((citation, index) => {
        doc
          .fontSize(12)
          .text(`${citation.source}`)
          .fontSize(10)
          .text(`Reference: ${citation.reference}`)
          .text(`Context: ${citation.context}`)
          .moveDown();
      });

      // Footer with page numbers
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(10)
          .text(
            `Page ${i + 1} of ${pageCount}`,
            doc.page.margins.left,
            doc.page.height - doc.page.margins.bottom - 20,
            { align: 'center' }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function generateReport(
  reportId: number,
  type: string,
  config: ReportConfig
): Promise<void> {
  try {
    const data: ReportData = {};
    let pdfBuffer: Buffer | null = null;

    // Generate different sections based on report type and config
    switch (type) {
      case "COMPLIANCE_SUMMARY":
        data.summary = await generateComplianceSummary(config);
        break;
      case "RISK_ANALYSIS":
        data.summary = await generateRiskAnalysis(config);
        break;
      case "CONTRACT_STATISTICS":
        data.summary = await generateContractStats(config);
        break;
      case "CUSTOM":
        data.summary = await generateCustomReport(config);
        break;
      case "LEGAL_RESEARCH":
          // Add handling for the new report type
          break;
    }

    // Update report with generated data
    await db
      .update(reports)
      .set({
        status: "COMPLETED" as const,
        data,
        pdfUrl: pdfBuffer ? `/api/reports/${reportId}/pdf` : undefined,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, reportId));

  } catch (error) {
    console.error("Report generation error:", error);
    await db
      .update(reports)
      .set({
        status: "ERROR" as const,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        updatedAt: new Date(),
      })
      .where(eq(reports.id, reportId));
    throw error;
  }
}

async function generateComplianceSummary(config: ReportConfig) {
  // Implement compliance summary generation
  return {
    totalDocuments: 0,
    compliantDocuments: 0,
    complianceRate: 0,
    topIssues: [],
    recentUpdates: [],
  };
}

async function generateRiskAnalysis(config: ReportConfig) {
  // Implement risk analysis generation
  return {
    overallRiskScore: 0,
    highRiskDocuments: 0,
    riskCategories: [],
    recommendations: [],
  };
}

async function generateContractStats(config: ReportConfig) {
  // Implement contract statistics generation
  return {
    totalContracts: 0,
    activeContracts: 0,
    expiringContracts: [],
    contractTypes: [],
    valueDistribution: [],
  };
}

async function generateCustomReport(config: ReportConfig) {
  // Implement custom report generation based on config
  return {
    customData: [],
    generatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    configUsed: config,
  };
}