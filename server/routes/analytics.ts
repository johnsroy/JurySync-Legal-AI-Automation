import { Router } from "express";
import { db } from "../db";
import { reports } from "@shared/schema/reports";
import { modelMetrics, workflowMetrics, documentMetrics, userActivityMetrics } from "@shared/schema/metrics";
import { and, eq, gte } from "drizzle-orm";
import { subDays } from "date-fns";
import { metricsCollector } from "../services/metricsCollector";

const router = Router();

// Get analytics data with enhanced compliance metrics
router.get("/", async (req, res) => {
  try {
    const { timeRange = "7d" } = req.query;
    const startDate = subDays(new Date(), parseInt(timeRange.toString()));

    // Fetch document activity data
    const documentsData = await db
      .select()
      .from(documentMetrics)
      .where(
        and(
          eq(documentMetrics.userId, req.user!.id),
          gte(documentMetrics.startTime, startDate)
        )
      );

    // Process document activity data
    const documentActivity = documentsData.map(d => ({
      date: d.startTime,
      processed: d.successful ? 1 : 0,
      uploaded: 1,
    }));

    // Calculate risk distribution from document metrics
    const riskScores = documentsData
      .filter(d => d.metadata?.riskScore !== undefined)
      .map(d => d.metadata!.riskScore as number);

    const riskDistribution = {
      low: riskScores.filter(score => score < 0.3).length,
      medium: riskScores.filter(score => score >= 0.3 && score < 0.7).length,
      high: riskScores.filter(score => score >= 0.7).length
    };

    // Get workflow metrics
    const workflowData = await db
      .select()
      .from(workflowMetrics)
      .where(
        and(
          eq(workflowMetrics.userId, req.user!.id),
          gte(workflowMetrics.startTime, startDate)
        )
      );

    const complianceMetrics = workflowData
      .filter(w => w.workflowType === 'COMPLIANCE_CHECK')
      .map(workflow => ({
        name: workflow.status,
        value: workflow.metadata?.efficiency || 0
      }));

    const response = {
      documentActivity,
      riskDistribution: Object.entries(riskDistribution).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
      })),
      complianceMetrics
    };

    res.json(response);
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics data" });
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

    if (type !== "all") {
      const reportType = type.toString().toUpperCase();
      if (reportType in reports.type.enumValues) {
        query.where(eq(reports.type, reportType as any));
      }
    }

    const allReports = await query;
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

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [report] = await db
      .insert(reports)
      .values({
        type: type.toUpperCase(),
        userId: req.user.id,
        status: "GENERATING",
        config: config || {},
        title: title || `Report ${new Date().toISOString()}`
      })
      .returning();

    res.json(report);
  } catch (error) {
    console.error("Report creation error:", error);
    res.status(500).json({ error: "Failed to create report" });
  }
});

export default router;