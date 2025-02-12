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
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { timeRange = "7d" } = req.query;
    const startDate = subDays(new Date(), parseInt(timeRange.toString()));

    // Fetch document activity data with template info
    const documentsData = await db
      .select({
        id: documentMetrics.id,
        startTime: documentMetrics.startTime,
        successful: documentMetrics.successful,
        metadata: documentMetrics.metadata,
        templateUsed: documentMetrics.metadata.templateUsed,
        templateCategory: documentMetrics.metadata.templateCategory
      })
      .from(documentMetrics)
      .where(
        and(
          eq(documentMetrics.userId, req.user.id),
          gte(documentMetrics.startTime, startDate)
        )
      );

    // Process document activity data with template info
    const documentActivity = documentsData.map(d => ({
      date: d.startTime.toISOString().split('T')[0],
      processed: d.successful ? 1 : 0,
      uploaded: 1,
      template: d.metadata?.templateUsed || 'Custom',
      category: d.metadata?.templateCategory || 'None'
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

    // Get workflow metrics with template usage
    const workflowData = await db
      .select()
      .from(workflowMetrics)
      .where(
        and(
          eq(workflowMetrics.userId, req.user.id),
          gte(workflowMetrics.startTime, startDate)
        )
      );

    // Get metrics from metricsCollector
    const metrics = await metricsCollector.collectMetrics({
      start: startDate,
      end: new Date()
    });

    const response = {
      documentActivity,
      riskDistribution: Object.entries(riskDistribution).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
      })),
      modelPerformance: metrics.modelPerformance || [],
      automationMetrics: metrics.automationMetrics,
      workflowEfficiency: workflowData.map(w => ({
        name: w.workflowType,
        value: w.metadata?.efficiency || 0,
        template: w.metadata?.templateUsed || 'Custom',
        category: w.metadata?.templateCategory || 'None'
      }))
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
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { timeRange = "7d" } = req.query;
    const metrics = await metricsCollector.collectMetrics({
      start: subDays(new Date(), parseInt(timeRange.toString())),
      end: new Date()
    });

    const response = {
      modelDistribution: Object.entries(metrics.modelDistribution || {}).map(([model, percentage]) => ({
        name: model,
        value: percentage
      })),
      modelPerformance: metrics.modelPerformance || [],
      automationMetrics: metrics.automationMetrics,
      costEfficiency: metrics.costEfficiency || [],
      taskSuccess: [
        { taskType: "Document Analysis", successRate: metrics.documentAnalysisSuccessRate || 95 },
        { taskType: "Code Review", successRate: metrics.codeReviewSuccessRate || 92 },
        { taskType: "Research", successRate: metrics.researchSuccessRate || 88 },
        { taskType: "Compliance", successRate: metrics.complianceSuccessRate || 94 }
      ]
    };

    res.json(response);
  } catch (error) {
    console.error("Model metrics error:", error);
    res.status(500).json({ error: "Failed to fetch model metrics" });
  }
});

// Get reports with template information
router.get("/reports", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { type = "all" } = req.query;
    const query = db.select().from(reports);

    if (type !== "all") {
      query.where(eq(reports.type, type.toString()));
    }

    const allReports = await query;

    // Add template information to reports
    const reportsWithTemplates = await Promise.all(
      allReports.map(async (report) => {
        const documentData = await db
          .select({
            templateUsed: documentMetrics.metadata.templateUsed,
            templateCategory: documentMetrics.metadata.templateCategory
          })
          .from(documentMetrics)
          .where(eq(documentMetrics.id, report.documentId))
          .limit(1);

        return {
          ...report,
          template: documentData[0]?.templateUsed || 'Custom',
          category: documentData[0]?.templateCategory || 'None'
        };
      })
    );

    res.json(reportsWithTemplates);
  } catch (error) {
    console.error("Reports fetch error:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

export default router;