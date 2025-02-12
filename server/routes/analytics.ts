import { Router } from "express";
import { db } from "../db";
import { analyticsData, modelAnalytics, workflowAnalytics } from "@shared/schema/analytics";
import { and, eq, gte, sql } from "drizzle-orm";
import { subDays } from "date-fns";
import { analyticsService } from "../services/analyticsService";
import { metricsCollector } from "../services/metricsCollector";

const router = Router();

router.get("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { timeRange = "7d" } = req.query;
    const startDate = subDays(new Date(), parseInt(timeRange.toString()));
    const endDate = new Date();

    // Get aggregated metrics from the analytics service
    const analyticsMetrics = await analyticsService.getAggregatedMetrics({
      start: startDate,
      end: endDate
    });

    // Get document processing metrics
    const documentMetrics = await db
      .select({
        date: sql`date_trunc('day', ${analyticsData.timestamp})::date`,
        processed: sql<number>`count(*) filter (where success_rate > 0.5)::integer`,
        uploaded: sql<number>`count(*)::integer`
      })
      .from(analyticsData)
      .where(
        and(
          gte(analyticsData.timestamp, startDate),
          eq(analyticsData.taskType, 'document_processing')
        )
      )
      .groupBy(sql`date_trunc('day', ${analyticsData.timestamp})::date`);

    // Calculate risk distribution
    const riskDistribution = await db
      .select({
        riskLevel: sql`
          case 
            when success_rate >= 0.7 then 'Low Risk'
            when success_rate >= 0.3 then 'Medium Risk'
            else 'High Risk'
          end
        `,
        count: sql<number>`count(*)::integer`
      })
      .from(analyticsData)
      .where(gte(analyticsData.timestamp, startDate))
      .groupBy(sql`
        case 
          when success_rate >= 0.7 then 'Low Risk'
          when success_rate >= 0.3 then 'Medium Risk'
          else 'High Risk'
        end
      `);

    // Get automation metrics from metrics collector
    const metrics = await metricsCollector.collectMetrics({
      start: startDate,
      end: endDate
    });

    // Format the response
    const response = {
      documentActivity: documentMetrics.map(doc => ({
        date: doc.date.toISOString().split('T')[0],
        processed: doc.processed,
        uploaded: doc.uploaded
      })),
      riskDistribution: riskDistribution.map(risk => ({
        name: risk.riskLevel,
        value: risk.count
      })),
      modelPerformance: analyticsMetrics.modelPerformance,
      automationMetrics: metrics.automationMetrics,
      workflowEfficiency: analyticsMetrics.workflowEfficiency,
      modelDistribution: analyticsMetrics.modelDistribution,
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