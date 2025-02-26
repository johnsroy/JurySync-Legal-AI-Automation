import { Router } from "express";
import { metricsCollector } from "../services/metricsCollector";
import debug from "debug";

const log = debug("app:metrics");
const router = Router();

// Existing performance endpoint
router.get('/performance', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Parse time range from query parameters
    const { start, end } = req.query;
    const timeRange = start && end ? {
      start: new Date(start as string),
      end: new Date(end as string)
    } : undefined;

    const metrics = await metricsCollector.collectMetrics(timeRange);
    res.json(metrics);
  } catch (error: any) {
    log('Error fetching performance metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

// New unified metrics endpoint
router.get('/unified', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    log('Collecting unified metrics for user:', userId);

    // Get default time range (last 30 days)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    // Collect all metrics
    const [performanceMetrics, documentMetrics, complianceMetrics] = await Promise.all([
      metricsCollector.collectMetrics({ start, end }),
      metricsCollector.collectDocumentMetrics(userId),
      metricsCollector.collectComplianceMetrics(userId)
    ]);

    log('Successfully collected unified metrics');

    res.json({
      success: true,
      metrics: {
        performance: performanceMetrics,
        documents: documentMetrics,
        compliance: complianceMetrics,
        timeRange: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      }
    });
  } catch (error: any) {
    log('Error fetching unified metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;