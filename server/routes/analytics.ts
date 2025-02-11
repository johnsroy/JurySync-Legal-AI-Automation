import { Router } from "express";
import { db } from "../db";
import { reports, analyticsData, complianceDocuments } from "@shared/schema";
import { and, eq, gte, desc } from "drizzle-orm";
import { subDays } from "date-fns";
import { generateWeeklyAnalytics } from "../services/complianceMonitor";
import { generateCompliancePDF } from "../services/reportGenerator";

const router = Router();

// Get analytics data with enhanced compliance metrics
router.get("/", async (req, res) => {
  try {
    const { timeRange = "7d" } = req.query;
    const daysToSubtract = parseInt(timeRange.toString());
    const startDate = subDays(new Date(), daysToSubtract);

    // Generate fresh weekly analytics
    const weeklyAnalytics = await generateWeeklyAnalytics();

    // Process document activity data
    const documentActivity = await db
      .select()
      .from(complianceDocuments)
      .where(gte(complianceDocuments.createdAt, startDate))
      .orderBy(desc(complianceDocuments.createdAt));

    // Convert risk distribution to chart format
    const riskDistribution = Object.entries(weeklyAnalytics.riskDistribution).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }));

    // Create compliance metrics from common issues
    const complianceMetrics = weeklyAnalytics.commonIssues.map(issue => ({
      name: issue.type,
      value: issue.count
    }));

    const response = {
      totalDocuments: weeklyAnalytics.totalDocuments,
      documentIncrease: weeklyAnalytics.trends.complianceRateTrend,
      averageRiskScore: weeklyAnalytics.averageRiskScore,
      riskScoreChange: weeklyAnalytics.trends.riskScoreTrend,
      complianceRate: 100 - (weeklyAnalytics.riskDistribution.high / weeklyAnalytics.totalDocuments * 100),
      complianceChange: weeklyAnalytics.trends.complianceRateTrend,
      documentActivity: documentActivity.map(doc => ({
        date: doc.createdAt,
        processed: 1,
        uploaded: 1
      })),
      riskDistribution,
      complianceMetrics,
      automationMetrics: {
        processingTimeReduction: "45%",
        laborCostSavings: "35%",
        errorReduction: "60%"
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics data" });
  }
});

// Get recent documents
router.get("/documents/recent", async (req, res) => {
  try {
    const recentDocs = await db
      .select()
      .from(complianceDocuments)
      .orderBy(desc(complianceDocuments.lastScanned))
      .limit(5);

    const documents = recentDocs.map(doc => ({
      id: doc.id,
      title: doc.title,
      status: doc.status,
      lastModified: doc.lastScanned,
      riskScore: doc.riskScore
    }));

    res.json(documents);
  } catch (error) {
    console.error("Recent documents fetch error:", error);
    res.status(500).json({ error: "Failed to fetch recent documents" });
  }
});

// Export analytics and documents report
router.post("/reports/export", async (req, res) => {
  try {
    const weeklyAnalytics = await generateWeeklyAnalytics();
    const recentDocs = await db
      .select()
      .from(complianceDocuments)
      .orderBy(desc(complianceDocuments.lastScanned))
      .limit(10);

    const result = {
      summary: "Legal Analytics and Document Report",
      riskLevel: weeklyAnalytics.averageRiskScore > 70 ? "HIGH" : weeklyAnalytics.averageRiskScore > 30 ? "MEDIUM" : "LOW",
      score: weeklyAnalytics.averageRiskScore,
      riskScores: {
        distribution: weeklyAnalytics.riskDistribution
      },
      issues: weeklyAnalytics.commonIssues.map(issue => ({
        clause: issue.type,
        severity: issue.severity,
        description: `Frequent issue type: ${issue.type}`,
        recommendation: "Review and update compliance policies"
      })),
      recommendedActions: weeklyAnalytics.commonIssues.map(issue => ({
        action: `Address ${issue.type} compliance issues`,
        impact: "Improve overall compliance score"
      }))
    };

    const pdfBuffer = await generateCompliancePDF(result);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=legal-analytics-report-${new Date().toISOString().split('T')[0]}.pdf`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to generate export" });
  }
});

// Get model performance metrics
router.get("/metrics/models", async (req, res) => {
  try {
    const { timeRange = "7d" } = req.query;
    const metrics = await metricsCollector.collectMetrics({
      start: subDays(new Date(), parseInt(timeRange.toString())),
      end: new Date()
    });

    const response = {
      modelDistribution: Object.entries(metrics.modelDistribution).map(([model, percentage]) => ({
        name: model,
        value: percentage
      })),
      modelPerformance: Object.entries(metrics.errorRates).map(([model, errorRate]) => ({
        model,
        errorRate: Math.round(errorRate * 100),
        avgProcessingTime: metrics.averageProcessingTime
      })),
      automationMetrics: {
        automationPercentage: metrics.automationMetrics.automationPercentage,
        processingTimeReduction: metrics.automationMetrics.processingTimeReduction,
        laborCostSavings: metrics.automationMetrics.laborCostSavings,
        errorReduction: metrics.automationMetrics.errorReduction
      },
      costEfficiency: Object.entries(metrics.modelDistribution).map(([model, _]) => ({
        model,
        costSavings: Math.round(metrics.costSavings)
      })),
      taskSuccess: [
        { taskType: "Document Analysis", successRate: 95 },
        { taskType: "Code Review", successRate: 92 },
        { taskType: "Research", successRate: 88 },
        { taskType: "Compliance", successRate: 94 }
      ]
    };

    res.json(response);
  } catch (error) {
    console.error("Model metrics error:", error);
    res.status(500).json({ error: "Failed to fetch model metrics" });
  }
});

// Get reports
router.get("/reports", async (req, res) => {
  try {
    const { type = "all" } = req.query;
    const query = db.select().from(reports);
    const whereClause = type !== "all" ? eq(reports.type, type as any) : undefined;
    const allReports = await (whereClause ? query.where(whereClause) : query);
    res.json(allReports);
  } catch (error) {
    console.error("Reports fetch error:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// Generate a new report
router.post("/reports", async (req, res) => {
  try {
    const { title, type, config } = req.body;

    const [report] = await db
      .insert(reports)
      .values({
        title,
        type,
        config,
        userId: req.user!.id,
        status: "GENERATING",
      })
      .returning();

    // Start report generation in background
    generateReport(report.id, type, config)
      .catch(error => {
        console.error("Report generation error:", error);
        db.update(reports)
          .set({ status: "ERROR" })
          .where(eq(reports.id, report.id))
          .execute();
      });

    res.json(report);

  } catch (error) {
    console.error("Report creation error:", error);
    res.status(500).json({ error: "Failed to create report" });
  }
});

// Get a specific report by ID
router.get("/reports/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, parseInt(id)));

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json(report);

  } catch (error) {
    console.error("Report fetch error:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

async function generateReport(reportId: number, type: string, config: any) {
  // Implement report generation logic here
  // This will be implemented in the next iteration
}

export default router;