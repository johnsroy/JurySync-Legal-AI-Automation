import { Router } from "express";
import { db } from "../db";
import { reports, analyticsData } from "@shared/schema/reports";
import { and, eq, gte } from "drizzle-orm";
import { subDays } from "date-fns";
import { generateWeeklyAnalytics } from "../services/complianceMonitor";

const router = Router();

interface AnalyticsResponse {
  totalDocuments: number;
  documentIncrease: number;
  averageRiskScore: number;
  riskScoreChange: number;
  complianceRate: number;
  complianceChange: number;
  documentActivity: Array<{
    date: Date;
    processed: number;
    uploaded: number;
  }>;
  riskDistribution: Array<{
    name: string;
    value: number;
  }>;
  complianceMetrics: Array<{
    name: string;
    value: number;
  }>;
}

// Get analytics data with enhanced compliance metrics
router.get("/", async (req, res) => {
  try {
    const { timeRange = "7d" } = req.query;
    const daysToSubtract = parseInt(timeRange.toString());
    const startDate = subDays(new Date(), daysToSubtract);

    // Generate fresh weekly analytics
    const weeklyAnalytics = await generateWeeklyAnalytics();

    // Fetch historical analytics data
    const [documentsData, analyticsMetrics] = await Promise.all([
      db.select().from(analyticsData).where(
        and(
          eq(analyticsData.metric, "document_activity"),
          gte(analyticsData.timestamp, startDate)
        )
      ),
      db.select().from(analyticsData).where(
        and(
          eq(analyticsData.metric, "weekly_compliance_report"),
          gte(analyticsData.timestamp, startDate)
        )
      ),
    ]);

    // Process document activity data
    const documentActivity = documentsData.map(d => ({
      date: d.timestamp,
      processed: (d.value as any).processed || 0,
      uploaded: (d.value as any).uploaded || 0,
    }));

    // Calculate metrics from weekly analytics
    const latestMetrics = weeklyAnalytics;
    const previousMetrics = analyticsMetrics[0]?.value as any || {};

    const calculateChange = (current: number, previous: number) => 
      previous ? ((current - previous) / previous) * 100 : 0;

    // Convert risk distribution to chart format
    const riskDistribution = Object.entries(latestMetrics.riskDistribution).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }));

    // Create compliance metrics from common issues
    const complianceMetrics = latestMetrics.commonIssues.map(issue => ({
      name: issue.type,
      value: issue.count
    }));

    const response: AnalyticsResponse = {
      totalDocuments: latestMetrics.totalDocuments,
      documentIncrease: calculateChange(
        latestMetrics.totalDocuments,
        previousMetrics.totalDocuments || 0
      ),
      averageRiskScore: latestMetrics.averageRiskScore,
      riskScoreChange: latestMetrics.trends.riskScoreTrend,
      complianceRate: 100 - (latestMetrics.riskDistribution.high / latestMetrics.totalDocuments * 100),
      complianceChange: latestMetrics.trends.complianceRateTrend,
      documentActivity,
      riskDistribution,
      complianceMetrics,
    };

    res.json(response);

  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics data" });
  }
});

// Get all reports
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