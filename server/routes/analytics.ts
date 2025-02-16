import { Router } from "express";
import { db } from "../db";
import { reports } from "@shared/schema/reports";
import { modelMetrics, workflowMetrics, documentMetrics } from "@shared/schema/metrics";
import { and, eq, gte, sql } from "drizzle-orm";
import { subDays } from "date-fns";
import { metricsCollector } from "../services/metricsCollector";
import { generateDashboardInsights } from "../services/dashboardAnalytics";

const router = Router();

// Get analytics data with enhanced compliance metrics
router.get("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { timeRange = "7d" } = req.query;
    const startDate = subDays(new Date(), parseInt(timeRange.toString()));

    // Get document metrics
    const documentsData = await db
      .select({
        id: documentMetrics.id,
        startTime: documentMetrics.startTime,
        successful: documentMetrics.successful,
        metadata: documentMetrics.metadata,
        documentType: documentMetrics.documentType,
        processingType: documentMetrics.processingType
      })
      .from(documentMetrics)
      .where(
        and(
          eq(documentMetrics.userId, req.user.id),
          gte(documentMetrics.startTime, startDate)
        )
      );

    // Process document activity data
    const documentActivityByDate = documentsData.reduce((acc, doc) => {
      const date = doc.startTime.toISOString().split('T')[0];

      if (!acc[date]) {
        acc[date] = {
          date,
          processed: 0,
          uploaded: 0
        };
      }

      acc[date].processed += doc.successful ? 1 : 0;
      acc[date].uploaded += 1;

      return acc;
    }, {} as Record<string, any>);

    // Convert to array format for charts
    const documentActivity = Object.values(documentActivityByDate);

    // Calculate risk distribution
    const riskDistribution = documentsData.reduce((acc, doc) => {
      const riskScore = doc.metadata?.riskScore || 0;
      let category;

      if (riskScore < 0.3) category = 'Low Risk';
      else if (riskScore < 0.7) category = 'Medium Risk';
      else category = 'High Risk';

      if (!acc[category]) acc[category] = 0;
      acc[category]++;

      return acc;
    }, {} as Record<string, number>);

    const riskDistributionData = Object.entries(riskDistribution).map(([name, value]) => ({
      name,
      value
    }));

    // Get workflow efficiency data
    const workflowData = await db
      .select({
        workflowType: workflowMetrics.workflowType,
        processingTimeMs: workflowMetrics.processingTimeMs,
        successful: workflowMetrics.successful,
        metadata: workflowMetrics.metadata
      })
      .from(workflowMetrics)
      .where(
        and(
          eq(workflowMetrics.userId, req.user.id),
          gte(workflowMetrics.startTime, startDate)
        )
      );

    // Calculate workflow efficiency
    const workflowEfficiency = workflowData.reduce((acc, workflow) => {
      const type = workflow.workflowType;
      if (!acc[type]) {
        acc[type] = {
          total: 0,
          successful: 0,
          totalTime: 0
        };
      }

      acc[type].total++;
      acc[type].successful += workflow.successful ? 1 : 0;
      acc[type].totalTime += workflow.processingTimeMs || 0;

      return acc;
    }, {} as Record<string, any>);

    const workflowEfficiencyData = Object.entries(workflowEfficiency).map(([type, data]) => ({
      name: type,
      successRate: Math.round((data.successful / data.total) * 100),
      avgProcessingTime: Math.round(data.totalTime / data.total)
    }));

    // Get metrics from metricsCollector
    const metrics = await metricsCollector.collectMetrics({
      start: startDate,
      end: new Date()
    });

    const response = {
      documentActivity,
      riskDistribution: riskDistributionData,
      modelPerformance: metrics.modelPerformance || [],
      automationMetrics: metrics.automationMetrics,
      workflowEfficiency: workflowEfficiencyData,
      modelDistribution: Object.entries(metrics.modelDistribution || {}).map(([model, value]) => ({
        name: model,
        value
      })),
      costEfficiency: metrics.costEfficiency || [],
      taskSuccess: [
        { taskType: "Document Analysis", successRate: metrics.documentAnalysisSuccessRate },
        { taskType: "Code Review", successRate: metrics.codeReviewSuccessRate },
        { taskType: "Research", successRate: metrics.researchSuccessRate },
        { taskType: "Compliance", successRate: metrics.complianceSuccessRate }
      ]
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

// Export the main router
export const analyticsRouter = router;

// Add the /api/metrics/unified route
analyticsRouter.get("/api/metrics/unified", async (req, res) => {
  try {
    // 1. Gather or compute your main metrics
    const documentsProcessed = 12; // e.g. from DB
    const averageProcessingTime = 47; // in seconds
    const complianceScore = 88; // in percentage
    const activeDocuments = 3; // how many active docs?

    // 2. Possibly fetch AI insights
    const aiInsights = await generateDashboardInsights();

    // 3. Provide chart data for the BarChart in the dashboard
    const activityData = [
      { date: "2025-02-14", documents: 6 },
      { date: "2025-02-15", documents: 10 },
      { date: "2025-02-16", documents: 7 },
    ];

    // Return JSON payload
    res.json({
      documentsProcessed,
      averageProcessingTime,
      complianceScore,
      activeDocuments,
      activityData,
      aiInsights
    });
  } catch (err) {
    console.error("Error in /api/metrics/unified:", err);
    res.status(500).json({ error: "Failed to retrieve analytics" });
  }
});