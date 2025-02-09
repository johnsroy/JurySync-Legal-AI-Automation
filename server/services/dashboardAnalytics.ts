import { Anthropic } from '@anthropic-ai/sdk';
import { complianceDocuments, complianceIssues } from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";

// Initialize Anthropic client
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface DashboardInsights {
  summary: string;
  trends: {
    label: string;
    value: number;
    change: number;
    insight: string;
  }[];
  riskDistribution: {
    category: string;
    count: number;
    percentage: number;
  }[];
  recommendations: {
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    action: string;
    impact: string;
  }[];
}

export async function generateDashboardInsights(): Promise<DashboardInsights> {
  // Fetch all compliance documents and their issues
  const documents = await db
    .select()
    .from(complianceDocuments)
    .where(eq(complianceDocuments.status, "MONITORING"));

  const issues = await db
    .select()
    .from(complianceIssues);

  // Prepare data for AI analysis
  const analysisData = {
    documentCount: documents.length,
    issueCount: issues.length,
    riskLevels: documents.map(doc => doc.riskScore),
    issueTypes: issues.map(issue => issue.severity),
    recentIssues: issues
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
      .slice(0, 10)
  };

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Generate dashboard insights from this compliance data:\n${JSON.stringify(analysisData, null, 2)}\n\nProvide insights in JSON format with:
            {
              "summary": "Overall state of compliance",
              "trends": [{"label": "string", "value": number, "change": number, "insight": "string"}],
              "riskDistribution": [{"category": "string", "count": number, "percentage": number}],
              "recommendations": [{"priority": "HIGH|MEDIUM|LOW", "action": "string", "impact": "string"}]
            }`
          }
        ]
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format from Anthropic API');
    }

    return JSON.parse(content.text);
  } catch (error) {
    console.error('Failed to generate dashboard insights:', error);
    throw error;
  }
}
