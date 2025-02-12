import { Anthropic } from "@anthropic-ai/sdk";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { complianceDocuments, complianceIssues, type ComplianceIssue, type RiskSeverity } from "@shared/schema";
import { metricsCollector } from "./metricsCollector";
import * as crypto from 'crypto';

// Initialize AI clients
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Constants for document processing
const MAX_CHUNK_SIZE = 12000; // Tokens per chunk
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Enhanced logging function
function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ComplianceMonitor] [${type.toUpperCase()}] ${message}`, context ? context : '');
}

interface IssueAnalysis {
  clause: string;
  description: string;
  severity: RiskSeverity;
  recommendation: string;
  reference?: string;
}

interface DocumentSection {
  title: string;
  content: string;
  level: number;
}

async function analyzeSection(section: DocumentSection, documentId: string): Promise<ComplianceIssue[]> {
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      const startTime = Date.now();
      const response = await anthropic.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this contract section titled "${section.title}" for compliance issues. Include regulatory references where applicable. Respond in JSON format with the following structure:
              {
                "issues": [
                  {
                    "clause": "string",
                    "description": "string",
                    "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",
                    "recommendation": "string",
                    "reference": "string"
                  }
                ]
              }`
            }
          ]
        }]
      });

      const processingTime = Date.now() - startTime;

      // Record metrics for model usage
      await metricsCollector.recordModelMetric({
        userId: 0, // System task
        taskId: crypto.randomUUID(),
        modelUsed: "claude-3-sonnet-20240229",
        taskType: "COMPLIANCE_CHECK",
        processingTimeMs: processingTime,
        tokenCount: section.content.length / 4, // Rough estimate
        metadata: {
          sectionTitle: section.title,
          documentId
        }
      });

      // Parse the response content as JSON
      const analysisText = response.content[0].text;
      if (!analysisText) {
        throw new Error("Empty response from Anthropic");
      }

      const analysis = JSON.parse(analysisText) as { issues: IssueAnalysis[] };

      // Transform the analysis into ComplianceIssue format
      return analysis.issues.map((issue) => ({
        id: crypto.randomUUID(),
        documentId,
        status: "OPEN",
        severity: issue.severity,
        clause: issue.clause,
        description: issue.description,
        recommendation: issue.recommendation,
        reference: issue.reference,
        detectedAt: new Date().toISOString()
      }));

    } catch (error) {
      retries++;
      if (retries === MAX_RETRIES) throw error;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
    }
  }
  throw new Error("Failed to analyze section after maximum retries");
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

async function performComplianceCheck(documentId: string, content: string): Promise<{
  issues: ComplianceIssue[];
  riskScore: number;
  status: "COMPLIANT" | "NON_COMPLIANT" | "FLAGGED";
  nextReviewDate: Date;
}> {
  const sections = chunkDocument(content);
  let totalRiskScore = 0;
  let criticalIssues = 0;
  const allIssues: ComplianceIssue[] = [];

  // Record start of document processing
  const startTime = Date.now();
  await metricsCollector.recordDocumentMetric({
    userId: 0, // System task
    documentId,
    documentType: "LEGAL_DOCUMENT",
    processingType: "COMPLIANCE_CHECK",
    startTime: new Date(),
    pageCount: Math.ceil(content.length / 3000), // Rough estimate
    wordCount: content.split(/\s+/).length,
    successful: true
  });

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

  // Update document processing metrics
  await metricsCollector.recordDocumentMetric({
    userId: 0,
    documentId,
    documentType: "LEGAL_DOCUMENT",
    processingType: "COMPLIANCE_CHECK",
    startTime: new Date(startTime),
    completionTime: new Date(),
    processingTimeMs: Date.now() - startTime,
    successful: true,
    metadata: {
      riskScore,
      complexity: sections.length,
      suggestions: allIssues.length
    }
  });

  return {
    issues: allIssues,
    riskScore,
    status: criticalIssues > 0 ? "FLAGGED" : riskScore > 70 ? "NON_COMPLIANT" : "COMPLIANT",
    nextReviewDate
  };
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

async function monitorDocument(documentId: string): Promise<void> {
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

    // Record workflow start
    await metricsCollector.recordWorkflowMetric({
      userId: document.userId,
      workflowId: crypto.randomUUID(),
      workflowType: "COMPLIANCE_CHECK",
      status: "STARTED",
      startTime: new Date(),
      successful: true
    });

    // Perform compliance check
    const result = await performComplianceCheck(documentId, document.content);

    // Store new issues
    if (result.issues.length > 0) {
      await db.insert(complianceIssues).values(result.issues);
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

    // Record workflow completion
    await metricsCollector.recordWorkflowMetric({
      userId: document.userId,
      workflowId: crypto.randomUUID(),
      workflowType: "COMPLIANCE_CHECK",
      status: "COMPLETED",
      startTime: new Date(),
      completionTime: new Date(),
      successful: true,
      metadata: {
        efficiency: result.riskScore,
        costSavings: result.issues.length
      }
    });

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

export { monitorDocument };