import { Router } from "express";
import { db } from "../db";
import { reports } from "@shared/schema/reports";
import { modelMetrics, workflowMetrics, documentMetrics } from "@shared/schema/metrics";
import { and, eq, gte, sql } from "drizzle-orm";
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

// Get reports
router.get("/reports", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { type = "all" } = req.query;
    let query = db.select().from(reports);

    if (type !== "all") {
      query = query.where(sql`${reports.type} = ${type.toString()}`);
    }

    const allReports = await query;

    // Add document data to reports
    const reportsWithData = await Promise.all(
      allReports.map(async (report) => {
        const documentData = await db
          .select({
            metadata: documentMetrics.metadata
          })
          .from(documentMetrics)
          .where(eq(documentMetrics.id, report.documentId))
          .limit(1);

        const metadata = documentData[0]?.metadata || {};

        return {
          ...report,
          template: metadata.templateUsed || 'Custom',
          category: metadata.templateCategory || 'None'
        };
      })
    );

    res.json(reportsWithData);
  } catch (error) {
    console.error("Reports fetch error:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

export default router;