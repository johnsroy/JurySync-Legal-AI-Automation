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
  try {
    // Fetch all compliance documents and their issues
    const documents = await db
      .select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.status, "MONITORING"));

    const issues = await db
      .select()
      .from(complianceIssues);

    // Calculate basic metrics
    const totalDocuments = documents.length;
    const totalIssues = issues.length;
    const averageRiskScore = documents.reduce((acc, doc) => acc + (doc.riskScore || 0), 0) / totalDocuments;

    // Prepare data for AI analysis
    const analysisData = {
      metrics: {
        totalDocuments,
        totalIssues,
        averageRiskScore,
        documentsWithHighRisk: documents.filter(doc => (doc.riskScore || 0) > 75).length,
        documentsNeedingReview: documents.filter(doc => doc.nextScanDue && new Date(doc.nextScanDue) < new Date()).length
      },
      documents: documents.map(doc => ({
        title: doc.title,
        type: doc.documentType,
        riskScore: doc.riskScore,
        lastScanned: doc.lastScanned,
        status: doc.status
      })),
      recentIssues: issues
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 10)
    };

    // Get AI-powered insights
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this compliance data and generate dashboard insights:
            ${JSON.stringify(analysisData, null, 2)}

            Format response as JSON with:
            {
              "summary": "Overall state of compliance (2-3 sentences)",
              "trends": [
                {
                  "label": "metric name",
                  "value": number,
                  "change": number (-100 to 100),
                  "insight": "brief explanation"
                }
              ],
              "riskDistribution": [
                {
                  "category": "risk level",
                  "count": number,
                  "percentage": number
                }
              ],
              "recommendations": [
                {
                  "priority": "HIGH|MEDIUM|LOW",
                  "action": "specific action",
                  "impact": "expected impact"
                }
              ]
            }`
          }
        ]
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format from Anthropic API');
    }

    const insights = JSON.parse(content.text);

    // Add custom calculations to insights
    insights.riskDistribution = [
      {
        category: "High Risk (75-100)",
        count: documents.filter(d => (d.riskScore || 0) >= 75).length,
        percentage: (documents.filter(d => (d.riskScore || 0) >= 75).length / totalDocuments) * 100
      },
      {
        category: "Medium Risk (50-74)",
        count: documents.filter(d => (d.riskScore || 0) >= 50 && (d.riskScore || 0) < 75).length,
        percentage: (documents.filter(d => (d.riskScore || 0) >= 50 && (d.riskScore || 0) < 75).length / totalDocuments) * 100
      },
      {
        category: "Low Risk (0-49)",
        count: documents.filter(d => (d.riskScore || 0) < 50).length,
        percentage: (documents.filter(d => (d.riskScore || 0) < 50).length / totalDocuments) * 100
      }
    ];

    return insights;
  } catch (error) {
    console.error('Failed to generate dashboard insights:', error);
    throw error;
  }
}