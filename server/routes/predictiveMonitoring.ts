import { Router } from "express";
import { predictiveMonitoringService } from "../services/predictiveMonitoring";
import { insertMonitoringScheduleSchema } from "@shared/schema";
import { db } from "../db";
import { compliancePredictions, complianceAlerts } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Set up monitoring schedule for a document
router.post("/schedule/:documentId", async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const validatedData = insertMonitoringScheduleSchema.parse({
      ...req.body,
      documentId
    });

    const schedule = await predictiveMonitoringService.scheduleMonitoring(
      documentId,
      validatedData.frequency
    );

    res.json(schedule);
  } catch (error: any) {
    console.error("Failed to create monitoring schedule:", error);
    res.status(400).json({ error: error?.message || "Failed to create monitoring schedule" });
  }
});

// Generate prediction for a document
router.post("/predict/:documentId", async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const prediction = await predictiveMonitoringService.generatePrediction(documentId);
    res.json(prediction);
  } catch (error: any) {
    console.error("Failed to generate prediction:", error);
    res.status(400).json({ error: error?.message || "Failed to generate prediction" });
  }
});

// Get predictions for a document
router.get("/predictions/:documentId", async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const predictions = await db.select()
      .from(compliancePredictions)
      .where(eq(compliancePredictions.documentId, documentId))
      .orderBy(compliancePredictions.createdAt);

    res.json(predictions);
  } catch (error: any) {
    console.error("Failed to fetch predictions:", error);
    res.status(400).json({ error: error?.message || "Failed to fetch predictions" });
  }
});

// Get alerts for a document
router.get("/alerts/:documentId", async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const alerts = await db.select()
      .from(complianceAlerts)
      .where(eq(complianceAlerts.documentId, documentId))
      .orderBy(complianceAlerts.createdAt);

    res.json(alerts);
  } catch (error: any) {
    console.error("Failed to fetch alerts:", error);
    res.status(400).json({ error: error?.message || "Failed to fetch alerts" });
  }
});

// Acknowledge an alert
router.post("/alerts/:alertId/acknowledge", async (req, res) => {
  try {
    const alertId = parseInt(req.params.alertId);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [updatedAlert] = await db.update(complianceAlerts)
      .set({
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
        acknowledgedBy: userId
      })
      .where(eq(complianceAlerts.id, alertId))
      .returning();

    res.json(updatedAlert);
  } catch (error: any) {
    console.error("Failed to acknowledge alert:", error);
    res.status(400).json({ error: error?.message || "Failed to acknowledge alert" });
  }
});

export default router;