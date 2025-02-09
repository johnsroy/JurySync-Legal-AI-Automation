import { OpenAI } from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { db } from "../db";
import { eq, and, lte } from "drizzle-orm";
import { complianceDocuments, complianceIssues, analyticsData } from "@shared/schema";

// Initialize AI clients
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Constants for document processing
const MAX_CHUNK_SIZE = 12000; // Tokens per chunk
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const SCAN_INTERVAL = 5 * 60 * 1000; // 5 minutes
const CHECK_BATCH_SIZE = 10;
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
          lte(complianceDocuments.createdAt, endDate),
          lte(startDate, complianceDocuments.createdAt)
        )
      );

    // Calculate analytics
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
          lte(complianceIssues.detectedAt, endDate),
          lte(startDate, complianceIssues.detectedAt)
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

    // Calculate trends (compare with previous week)
    const previousStartDate = new Date(startDate.getTime() - WEEKLY_REPORT_INTERVAL);
    const previousAudits = await db
      .select()
      .from(complianceDocuments)
      .where(
        and(
          lte(complianceDocuments.createdAt, startDate),
          lte(previousStartDate, complianceDocuments.createdAt)
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
      metric: 'weekly_compliance_report',
      value: analytics,
      metadata: {
        reportType: 'weekly',
        generatedAt: new Date().toISOString()
      }
    });

    log('Weekly analytics report generated successfully');
    return analytics;

  } catch (error) {
    log('Failed to generate weekly analytics', 'error', error);
    throw error;
  }
}

// Simulate regulatory updates (in a real system, this would fetch from external APIs)
async function checkForRegulatoryUpdates(): Promise<void> {
  try {
    log('Checking for regulatory updates');

    // Simulate checking external sources
    const simulatedUpdate = {
      timestamp: new Date().toISOString(),
      source: 'Regulatory API',
      updates: [
        {
          regulation: 'Privacy Policy Requirements',
          changeType: 'amendment',
          description: 'Updated requirements for data processing disclosures',
          effectiveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    };

    // Store update in analytics data
    await db.insert(analyticsData).values({
      metric: 'regulatory_update',
      value: simulatedUpdate,
      metadata: {
        updateType: 'scheduled',
        source: 'automated_check'
      }
    });

    log('Regulatory updates processed successfully');
  } catch (error) {
    log('Failed to process regulatory updates', 'error', error);
    throw error;
  }
}

// Enhanced automated monitoring loop
async function runAutomatedMonitoring(): Promise<void> {
  try {
    // Check for documents due for scanning
    const documentsToCheck = await db
      .select()
      .from(complianceDocuments)
      .where(
        and(
          eq(complianceDocuments.status, "MONITORING"),
          lte(complianceDocuments.nextScanDue, new Date())
        )
      )
      .limit(CHECK_BATCH_SIZE);

    for (const document of documentsToCheck) {
      try {
        await monitorDocument(document.id);
      } catch (error) {
        log(`Failed to monitor document ${document.id}:`, 'error', error);
        continue;
      }
    }

    // Check for regulatory updates (weekly)
    const lastUpdate = await db
      .select()
      .from(analyticsData)
      .where(eq(analyticsData.metric, 'regulatory_update'))
      .orderBy(analyticsData.timestamp as any, 'desc')
      .limit(1);

    if (!lastUpdate.length || 
        new Date(lastUpdate[0].timestamp).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000) {
      await checkForRegulatoryUpdates();
    }

    // Generate weekly analytics report
    const lastAnalytics = await db
      .select()
      .from(analyticsData)
      .where(eq(analyticsData.metric, 'weekly_compliance_report'))
      .orderBy(analyticsData.timestamp as any, 'desc')
      .limit(1);

    if (!lastAnalytics.length || 
        new Date(lastAnalytics[0].timestamp).getTime() < Date.now() - WEEKLY_REPORT_INTERVAL) {
      await generateWeeklyAnalytics();
    }

  } catch (error) {
    log('Automated monitoring cycle failed:', 'error', error);
  } finally {
    // Schedule next run
    setTimeout(runAutomatedMonitoring, SCAN_INTERVAL);
  }
}

// Start automated monitoring
log('Starting automated compliance monitoring system...');
runAutomatedMonitoring().catch(error => {
  log('Failed to start automated monitoring:', 'error', error);
});

export {
  generateWeeklyAnalytics,
  checkForRegulatoryUpdates,
  type WeeklyAnalytics
};

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
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        temperature: 0.2,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this contract section titled "${section.title}" for compliance issues. Include regulatory references where applicable:\n\n${section.content}`
            }
          ]
        }],
        response_format: { type: "json_object" }
      });

      const content = response.content[0].text;
      if (!content) {
        throw new Error("Empty response from Anthropic API");
      }

      const analysis = JSON.parse(content);
      return analysis.issues.map((issue: any) => ({
        documentId,
        clause: issue.clause,
        description: issue.description,
        severity: issue.severity as RiskSeverity,
        recommendation: issue.recommendation,
        reference: issue.reference,
        detectedAt: new Date().toISOString(),
        status: "OPEN",
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

async function performComplianceCheck(document: ComplianceDocument): Promise<ComplianceCheckResult> {
  const sections = chunkDocument(document.content);
  let totalRiskScore = 0;
  let criticalIssues = 0;
  const allIssues: ComplianceIssue[] = [];

  // Analyze each section
  for (const section of sections) {
    const issues = await analyzeSection(section, document.id);
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

// Main monitoring function
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
    const result = await performComplianceCheck(document);

    // Store new issues
    await db.insert(complianceIssues).values(result.issues);

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


import type { ComplianceDocument, ComplianceIssue, RiskSeverity } from "@shared/schema";