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

    // Get document metrics with template info
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
    const documentActivity = documentsData.reduce((acc, doc) => {
      const date = doc.startTime.toISOString().split('T')[0];
      const template = doc.metadata?.templateUsed || 'Custom';
      const category = doc.metadata?.templateCategory || 'None';

      if (!acc[date]) {
        acc[date] = {
          date,
          processed: 0,
          uploaded: 0,
          byTemplate: {} as Record<string, number>,
          byCategory: {} as Record<string, number>
        };
      }

      acc[date].processed += doc.successful ? 1 : 0;
      acc[date].uploaded += 1;
      acc[date].byTemplate[template] = (acc[date].byTemplate[template] || 0) + 1;
      acc[date].byCategory[category] = (acc[date].byCategory[category] || 0) + 1;

      return acc;
    }, {} as Record<string, any>);

    // Convert to array and calculate percentages
    const documentActivityArray = Object.values(documentActivity).map(day => ({
      date: day.date,
      processed: day.processed,
      uploaded: day.uploaded,
      templates: Object.entries(day.byTemplate).map(([name, count]) => ({
        name,
        value: Math.round((count as number / day.uploaded) * 100)
      })),
      categories: Object.entries(day.byCategory).map(([name, count]) => ({
        name,
        value: Math.round((count as number / day.uploaded) * 100)
      }))
    }));

    // Get metrics from metricsCollector
    const metrics = await metricsCollector.collectMetrics({
      start: startDate,
      end: new Date()
    });

    // Get workflow metrics with enhanced details
    const workflowData = await db
      .select({
        id: workflowMetrics.id,
        workflowType: workflowMetrics.workflowType,
        status: workflowMetrics.status,
        metadata: workflowMetrics.metadata,
        processingTimeMs: workflowMetrics.processingTimeMs,
        successful: workflowMetrics.successful
      })
      .from(workflowMetrics)
      .where(
        and(
          eq(workflowMetrics.userId, req.user.id),
          gte(workflowMetrics.startTime, startDate)
        )
      );

    // Process workflow efficiency data
    const workflowEfficiency = workflowData.reduce((acc, workflow) => {
      const type = workflow.workflowType;
      if (!acc[type]) {
        acc[type] = {
          name: type,
          successRate: 0,
          avgProcessingTime: 0,
          totalRuns: 0,
          templates: {} as Record<string, number>,
          categories: {} as Record<string, number>
        };
      }

      acc[type].totalRuns++;
      acc[type].successRate += workflow.successful ? 1 : 0;
      acc[type].avgProcessingTime += workflow.processingTimeMs || 0;

      const template = workflow.metadata?.templateUsed || 'Custom';
      const category = workflow.metadata?.templateCategory || 'None';

      acc[type].templates[template] = (acc[type].templates[template] || 0) + 1;
      acc[type].categories[category] = (acc[type].categories[category] || 0) + 1;

      return acc;
    }, {} as Record<string, any>);

    // Calculate final percentages and averages
    const workflowEfficiencyArray = Object.values(workflowEfficiency).map(wf => ({
      name: wf.name,
      successRate: Math.round((wf.successRate / wf.totalRuns) * 100),
      avgProcessingTime: Math.round(wf.avgProcessingTime / wf.totalRuns),
      templates: Object.entries(wf.templates).map(([name, count]) => ({
        name,
        value: Math.round((count as number / wf.totalRuns) * 100)
      })),
      categories: Object.entries(wf.categories).map(([name, count]) => ({
        name,
        value: Math.round((count as number / wf.totalRuns) * 100)
      }))
    }));

    const response = {
      documentActivity: documentActivityArray,
      modelPerformance: metrics.modelPerformance,
      automationMetrics: metrics.automationMetrics,
      workflowEfficiency: workflowEfficiencyArray,
      modelDistribution: metrics.modelDistribution,
      costEfficiency: metrics.costEfficiency,
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

export default router;