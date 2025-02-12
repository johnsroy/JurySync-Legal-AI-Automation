import { Router } from "express";
import { analyticsService } from "../services/analyticsService";
import { subDays } from "date-fns";

const router = Router();

router.get("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { timeRange = "7d" } = req.query;
    const days = parseInt(timeRange.toString().replace("d", ""));

    const analytics = await analyticsService.getAnalytics({
      start: subDays(new Date(), days),
      end: new Date()
    });

    res.json(analytics);
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics data" });
  }
});

router.post("/record", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const metrics = await analyticsService.recordMetrics(req.body);
    res.json({ success: true, metrics });
  } catch (error) {
    console.error("Failed to record metrics:", error);
    res.status(500).json({ error: "Failed to record metrics" });
  }
});

export default router;