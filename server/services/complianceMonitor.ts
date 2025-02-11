import { OpenAI } from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { db } from "../db";
import { eq, and, lte, sql } from "drizzle-orm";
import { complianceDocuments, complianceIssues, analyticsData, type ComplianceIssue, type RiskSeverity } from "@shared/schema";

// Initialize AI clients
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Constants for document processing
const MAX_CHUNK_SIZE = 12000; // Tokens per chunk
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const WEEKLY_REPORT_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 1 week

// Enhanced logging function
function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ComplianceMonitor] [${type.toUpperCase()}] ${message}`, context ? context : '');
}

// Types for analytics
interface WeeklyAnalytics {
  startDate: string;
  endDate: string;
  totalDocuments: number;
  averageRiskScore: number;
  riskDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  commonIssues: Array<{
    type: string;
    count: number;
    severity: string;
  }>;
  trends: {
    riskScoreTrend: number;
    complianceRateTrend: number;
  };
}

// Generate weekly analytics report
async function generateWeeklyAnalytics(): Promise<WeeklyAnalytics> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - WEEKLY_REPORT_INTERVAL);

  try {
    // Get all audits from the past week
    const audits = await db
      .select()
      .from(complianceDocuments)
      .where(
        and(
          sql`${complianceDocuments.createdAt} <= ${new Date(endDate)}`,
          sql`${complianceDocuments.createdAt} >= ${new Date(startDate)}`
        )
      );

    const totalDocuments = audits.length;
    const riskScores = audits.map(a => a.riskScore || 0);
    const averageRiskScore = riskScores.reduce((a, b) => a + b, 0) / totalDocuments || 0;

    // Get risk distribution
    const riskDistribution = {
      high: audits.filter(a => (a.riskScore || 0) > 70).length,
      medium: audits.filter(a => (a.riskScore || 0) > 30 && (a.riskScore || 0) <= 70).length,
      low: audits.filter(a => (a.riskScore || 0) <= 30).length,
    };

    // Get common issues
    const issues = await db
      .select()
      .from(complianceIssues)
      .where(
        and(
          sql`${complianceIssues.createdAt} <= ${new Date(endDate)}`,
          sql`${complianceIssues.createdAt} >= ${new Date(startDate)}`
        )
      );

    const issueTypes = issues.reduce((acc: Record<string, { count: number; severity: string }>, issue) => {
      const key = issue.clause;
      if (!acc[key]) {
        acc[key] = { count: 0, severity: issue.severity };
      }
      acc[key].count++;
      return acc;
    }, {});

    const commonIssues = Object.entries(issueTypes)
      .map(([type, { count, severity }]) => ({ type, count, severity }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate trends
    const previousStartDate = new Date(startDate.getTime() - WEEKLY_REPORT_INTERVAL);
    const previousAudits = await db
      .select()
      .from(complianceDocuments)
      .where(
        and(
          sql`${complianceDocuments.createdAt} <= ${new Date(startDate)}`,
          sql`${complianceDocuments.createdAt} >= ${new Date(previousStartDate)}`
        )
      );

    const previousRiskScores = previousAudits.map(a => a.riskScore || 0);
    const previousAverageRisk = previousRiskScores.reduce((a, b) => a + b, 0) / previousAudits.length || 0;

    const riskScoreTrend = ((averageRiskScore - previousAverageRisk) / previousAverageRisk) * 100;
    const complianceRateTrend = ((totalDocuments - previousAudits.length) / previousAudits.length) * 100;

    const analytics: WeeklyAnalytics = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalDocuments,
      averageRiskScore,
      riskDistribution,
      commonIssues,
      trends: {
        riskScoreTrend,
        complianceRateTrend
      }
    };

    // Store analytics data
    await db.insert(analyticsData).values({
      timestamp: new Date(),
      period: 'weekly',
      metrics: {
        modelUsage: {},
        processingTimes: {},
        errorRates: {},
        costSavings: 0,
        automationMetrics: {
          automationPercentage: "0%",
          processingTimeReduction: "0%",
          laborCostSavings: "0%",
          errorReduction: "0%"
        }
      }
    });

    log('Weekly analytics report generated successfully');
    return analytics;

  } catch (error) {
    log('Failed to generate weekly analytics', 'error', error);
    throw error;
  }
}

interface DocumentSection {
  title: string;
  content: string;
  level: number;
}

interface ComplianceCheckResult {
  issues: ComplianceIssue[];
  riskScore: number;
  status: "COMPLIANT" | "NON_COMPLIANT" | "FLAGGED";
  nextReviewDate: Date;
}

async function analyzeSection(section: DocumentSection, documentId: number): Promise<ComplianceIssue[]> {
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this contract section titled "${section.title}" for compliance issues. Include regulatory references where applicable:\n\n${section.content}`
            }
          ]
        }]
      });

      const analysis = response.content[0].value as {
        issues: Array<{
          clause: string;
          description: string;
          severity: RiskSeverity;
          recommendation: string;
          reference?: string;
        }>;
      };

      // Transform the analysis into ComplianceIssue format
      return analysis.issues.map((issue) => ({
        documentId,
        riskAssessmentId: 0,
        clause: issue.clause,
        description: issue.description,
        severity: issue.severity,
        recommendation: issue.recommendation,
        reference: issue.reference,
        status: "OPEN" as const
      }));

    } catch (error) {
      retries++;
      if (retries === MAX_RETRIES) throw error;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
    }
  }
  throw new Error("Failed to analyze section after maximum retries");
}

function chunkDocument(content: string): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const lines = content.split('\n');
  let currentSection: DocumentSection = {
    title: 'General',
    content: '',
    level: 1
  };

  for (const line of lines) {
    if (line.trim().length === 0) continue;

    // Check if line is a heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (currentSection.content.trim().length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        title: headingMatch[2],
        content: '',
        level: headingMatch[1].length
      };
    } else {
      if (currentSection.content.length + line.length > MAX_CHUNK_SIZE) {
        sections.push(currentSection);
        currentSection = {
          title: `${currentSection.title} (continued)`,
          content: line,
          level: currentSection.level
        };
      } else {
        currentSection.content += line + '\n';
      }
    }
  }

  if (currentSection.content.trim().length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

function getIssueSeverityScore(severity: RiskSeverity): number {
  const scores: Record<RiskSeverity, number> = {
    CRITICAL: 10,
    HIGH: 7,
    MEDIUM: 4,
    LOW: 2,
    INFO: 1
  };
  return scores[severity];
}

function calculateOverallRiskScore(totalScore: number, criticalIssues: number, sectionCount: number): number {
  let score = Math.round(totalScore / sectionCount);
  if (criticalIssues > 0) {
    score += Math.min(criticalIssues * 10, 30);
  }
  return Math.max(0, Math.min(100, score));
}

async function performComplianceCheck(documentId: number, content: string): Promise<ComplianceCheckResult> {
  const sections = chunkDocument(content);
  let totalRiskScore = 0;
  let criticalIssues = 0;
  const allIssues: ComplianceIssue[] = [];

  // Analyze each section
  for (const section of sections) {
    const issues = await analyzeSection(section, documentId);
    allIssues.push(...issues);

    // Calculate risk score
    for (const issue of issues) {
      if (issue.severity === "CRITICAL") criticalIssues++;
      totalRiskScore += getIssueSeverityScore(issue.severity);
    }
  }

  const riskScore = calculateOverallRiskScore(totalRiskScore, criticalIssues, sections.length);

  // Determine next review date based on risk score
  const nextReviewDate = new Date();
  if (riskScore < 30) {
    nextReviewDate.setDate(nextReviewDate.getDate() + 7); // Weekly for low risk
  } else if (riskScore < 70) {
    nextReviewDate.setDate(nextReviewDate.getDate() + 3); // Every 3 days for medium risk
  } else {
    nextReviewDate.setDate(nextReviewDate.getDate() + 1); // Daily for high risk
  }

  return {
    issues: allIssues,
    riskScore,
    status: criticalIssues > 0 ? "FLAGGED" : riskScore > 70 ? "NON_COMPLIANT" : "COMPLIANT",
    nextReviewDate
  };
}

async function monitorDocument(documentId: number): Promise<void> {
  try {
    log(`Starting compliance check for document ${documentId}`);

    // Get document from database
    const [document] = await db
      .select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.id, documentId));

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Update status to checking
    await db
      .update(complianceDocuments)
      .set({ status: "CHECKING" })
      .where(eq(complianceDocuments.id, documentId));

    // Perform compliance check
    const result = await performComplianceCheck(documentId, document.content);

    // Store new issues
    const issueInserts = result.issues.map(issue => ({
      ...issue,
      documentId: document.id,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    if (issueInserts.length > 0) {
      await db.insert(complianceIssues).values(issueInserts);
    }

    // Update document status
    await db
      .update(complianceDocuments)
      .set({
        status: result.status,
        riskScore: result.riskScore,
        lastScanned: new Date(),
        nextScanDue: result.nextReviewDate
      })
      .where(eq(complianceDocuments.id, documentId));

    log(`Compliance check completed for document ${documentId}`);

  } catch (error) {
    log(`Monitoring failed for document ${documentId}:`, 'error', error);

    // Update document status to error
    await db
      .update(complianceDocuments)
      .set({ status: "ERROR" })
      .where(eq(complianceDocuments.id, documentId));

    throw error;
  }
}

export { generateWeeklyAnalytics, monitorDocument, type WeeklyAnalytics };