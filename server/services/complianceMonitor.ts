import Anthropic from '@anthropic-ai/sdk';
import type { ComplianceDocument, ComplianceIssue, RiskSeverity } from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { complianceDocuments, complianceIssues } from "@shared/schema";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Constants for document processing
const MAX_CHUNK_SIZE = 12000; // Tokens per chunk
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

interface DocumentSection {
  title: string;
  content: string;
  level: number;
}

async function analyzeSection(section: DocumentSection, documentId: string): Promise<ComplianceIssue[]> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      messages: [
        {
          role: "system",
          content: `You are a legal contract analysis expert. Analyze the given section and return a detailed JSON analysis focusing on compliance issues. For each issue include:
            1. Clause location and content
            2. Severity (CRITICAL, HIGH, MEDIUM, LOW, INFO)
            3. Description of the issue
            4. Specific recommendation to resolve it
            5. Reference to relevant regulations if applicable`
        },
        {
          role: "user",
          content: `Analyze this contract section titled "${section.title}":\n\n${section.content}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1000
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
    console.error("Analysis error:", error);
    throw error;
  }
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

export async function analyzeDocument(documentId: string): Promise<void> {
  try {
    // Get document from database
    const [document] = await db
      .select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.id, parseInt(documentId)));

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    console.log(`Starting analysis for document ${documentId}`);

    // Update status to processing
    await db
      .update(complianceDocuments)
      .set({ status: "MONITORING" })
      .where(eq(complianceDocuments.id, document.id));

    // Split document into sections
    const sections = chunkDocument(document.content);
    console.log(`Document split into ${sections.length} sections`);

    // Analyze each section
    let totalRiskScore = 0;
    let criticalIssues = 0;
    for (const section of sections) {
      const issues = await analyzeSection(section, documentId);

      // Calculate risk score based on issues
      for (const issue of issues) {
        if (issue.severity === "CRITICAL") criticalIssues++;
        totalRiskScore += getIssueSeverityScore(issue.severity);

        // Store issue in database
        await db.insert(complianceIssues).values({
          documentId: document.id,
          clause: issue.clause,
          description: issue.description,
          severity: issue.severity,
          recommendation: issue.recommendation,
          reference: issue.reference,
          status: "OPEN",
        });
      }
    }

    // Update document with risk score and scan timestamp
    const riskScore = calculateOverallRiskScore(totalRiskScore, criticalIssues, sections.length);
    await db
      .update(complianceDocuments)
      .set({
        riskScore,
        lastScanned: new Date(),
        nextScanDue: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next scan in 24 hours
        status: criticalIssues > 0 ? "FLAGGED" : "MONITORING"
      })
      .where(eq(complianceDocuments.id, document.id));

    console.log(`Analysis complete for document ${documentId}. Risk score: ${riskScore}`);
  } catch (error) {
    console.error(`Analysis failed for document ${documentId}:`, error);

    // Update document status to error
    await db
      .update(complianceDocuments)
      .set({ status: "ERROR" })
      .where(eq(complianceDocuments.id, parseInt(documentId)));

    throw error;
  }
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
  // Base score is average per section
  let score = Math.round(totalScore / sectionCount);

  // Critical issues increase the score
  if (criticalIssues > 0) {
    score += Math.min(criticalIssues * 10, 30); // Cap the critical issue penalty
  }

  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score));
}

// This function should be called by a scheduled job
export async function runScheduledMonitoring(): Promise<void> {
  const documents = await db
    .select()
    .from(complianceDocuments)
    .where(eq(complianceDocuments.status, "MONITORING"));

  for (const document of documents) {
    if (document.nextScanDue && new Date(document.nextScanDue) <= new Date()) {
      try {
        await analyzeDocument(document.id.toString());
      } catch (error) {
        console.error(`Scheduled monitoring failed for document ${document.id}:`, error);
      }
    }
  }
}

// Start periodic monitoring
setInterval(runScheduledMonitoring, 5 * 60 * 1000); // Check every 5 minutes