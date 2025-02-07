import { Router } from "express";
import { db } from "../db";
import { reports, analyticsData } from "@shared/schema/reports";
import { and, eq, gte } from "drizzle-orm";
import { subDays } from "date-fns";

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

// Get analytics data
router.get("/", async (req, res) => {
  try {
    const { timeRange = "7d" } = req.query;
    const daysToSubtract = parseInt(timeRange.toString());
    const startDate = subDays(new Date(), daysToSubtract);

    const [documentsData, analyticsMetrics] = await Promise.all([
      // Fetch document statistics
      db.select().from(analyticsData).where(
        and(
          eq(analyticsData.metric, "document_activity"),
          gte(analyticsData.timestamp, startDate)
        )
      ),
      // Fetch key metrics
      db.select().from(analyticsData).where(
        and(
          eq(analyticsData.metric, "key_metrics"),
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

    // Calculate metrics
    const latestMetrics = analyticsMetrics[analyticsMetrics.length - 1]?.value as Record<string, number> || {};
    const previousMetrics = analyticsMetrics[0]?.value as Record<string, number> || {};

    const calculateChange = (current: number, previous: number) => 
      previous ? ((current - previous) / previous) * 100 : 0;

    const response: AnalyticsResponse = {
      totalDocuments: latestMetrics.totalDocuments || 0,
      documentIncrease: calculateChange(
        latestMetrics.totalDocuments || 0,
        previousMetrics.totalDocuments || 0
      ),
      averageRiskScore: latestMetrics.averageRiskScore || 0,
      riskScoreChange: calculateChange(
        latestMetrics.averageRiskScore || 0,
        previousMetrics.averageRiskScore || 0
      ),
      complianceRate: latestMetrics.complianceRate || 0,
      complianceChange: calculateChange(
        latestMetrics.complianceRate || 0,
        previousMetrics.complianceRate || 0
      ),
      documentActivity,
      riskDistribution: latestMetrics.riskDistribution || [],
      complianceMetrics: latestMetrics.complianceMetrics || [],
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