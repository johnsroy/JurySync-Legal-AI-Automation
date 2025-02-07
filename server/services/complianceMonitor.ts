import Anthropic from '@anthropic-ai/sdk';
import type { ComplianceDocument, ComplianceIssue, RiskSeverity } from "@shared/schema";
import { db } from "../db";
import { eq, and, lte } from "drizzle-orm";
import { complianceDocuments, complianceIssues } from "@shared/schema";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Constants for document processing
const MAX_CHUNK_SIZE = 12000; // Tokens per chunk
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const SCAN_INTERVAL = 5 * 60 * 1000; // 5 minutes
const CHECK_BATCH_SIZE = 10;

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
export async function monitorDocument(documentId: number): Promise<void> {
  try {
    console.log(`Starting compliance check for document ${documentId}`);

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

    console.log(`Compliance check completed for document ${documentId}`);

  } catch (error) {
    console.error(`Monitoring failed for document ${documentId}:`, error);

    // Update document status to error
    await db
      .update(complianceDocuments)
      .set({ status: "ERROR" })
      .where(eq(complianceDocuments.id, documentId));

    throw error;
  }
}

// Automated monitoring loop
async function runAutomatedMonitoring(): Promise<void> {
  try {
    // Get documents due for scanning
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
        console.error(`Failed to monitor document ${document.id}:`, error);
        continue; // Continue with next document even if one fails
      }
    }
  } catch (error) {
    console.error('Automated monitoring cycle failed:', error);
  } finally {
    // Schedule next run
    setTimeout(runAutomatedMonitoring, SCAN_INTERVAL);
  }
}

// Start automated monitoring
console.log('Starting automated compliance monitoring system...');
runAutomatedMonitoring().catch(error => {
  console.error('Failed to start automated monitoring:', error);
});