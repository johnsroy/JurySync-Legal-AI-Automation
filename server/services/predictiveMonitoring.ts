import { db } from "../db";
import { InsertPrediction, InsertAlert, MonitoringFrequency, PredictionConfidence } from "@shared/schema";
import { complianceDocuments, compliancePredictions, complianceAlerts, complianceMonitoringSchedules } from "@shared/schema";
import { eq, and, lte } from "drizzle-orm";
import { Anthropic } from "@anthropic-ai/sdk";

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export class PredictiveMonitoringService {
  async scheduleMonitoring(documentId: number, frequency: MonitoringFrequency) {
    const nextCheck = this.calculateNextCheck(frequency);

    return await db.insert(complianceMonitoringSchedules)
      .values({
        documentId,
        frequency,
        nextScheduled: nextCheck,
        isActive: true,
      })
      .returning();
  }

  async generatePrediction(documentId: number): Promise<InsertPrediction> {
    // Get document content
    const [document] = await db.select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.id, documentId));

    if (!document) {
      throw new Error("Document not found");
    }

    // Generate prediction using AI
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Analyze this document for potential compliance risks and provide a prediction in JSON format:
        
        Document Content:
        ${document.content}
        
        Analyze the document and provide:
        1. Predicted compliance status
        2. Confidence level (HIGH/MEDIUM/LOW)
        3. Risk factors (array of objects with factor, impact score 0-100, and description)
        4. Suggested actions (array of objects with action, priority HIGH/MEDIUM/LOW, and optional deadline)
        `
      }]
    });

    try {
      const analysis = JSON.parse(message.content[0].text);
      
      const prediction: InsertPrediction = {
        documentId,
        predictedStatus: analysis.status,
        confidence: analysis.confidence,
        riskFactors: analysis.riskFactors,
        suggestedActions: analysis.suggestedActions,
        deadline: analysis.suggestedActions.find((a: any) => a.deadline)?.deadline,
      };

      // Save prediction
      const [savedPrediction] = await db.insert(compliancePredictions)
        .values(prediction)
        .returning();

      // Generate alerts for high-risk factors
      const highRiskFactors = analysis.riskFactors.filter((rf: any) => rf.impact > 75);
      
      if (highRiskFactors.length > 0) {
        await this.createAlerts(savedPrediction.id, documentId, highRiskFactors);
      }

      return savedPrediction;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      throw new Error('Failed to generate prediction');
    }
  }

  private async createAlerts(predictionId: number, documentId: number, riskFactors: any[]): Promise<void> {
    const alerts = riskFactors.map(rf => ({
      predictionId,
      documentId,
      severity: 'HIGH',
      message: `High risk detected: ${rf.factor} (Impact Score: ${rf.impact}) - ${rf.description}`,
      status: 'PENDING'
    }));

    await db.insert(complianceAlerts)
      .values(alerts);
  }

  private calculateNextCheck(frequency: MonitoringFrequency): Date {
    const now = new Date();
    switch (frequency) {
      case "REALTIME":
        return now;
      case "HOURLY":
        return new Date(now.setHours(now.getHours() + 1));
      case "DAILY":
        return new Date(now.setDate(now.getDate() + 1));
      case "WEEKLY":
        return new Date(now.setDate(now.getDate() + 7));
      case "MONTHLY":
        return new Date(now.setMonth(now.getMonth() + 1));
      default:
        return new Date(now.setDate(now.getDate() + 1)); // Default to daily
    }
  }

  async checkScheduledMonitoring(): Promise<void> {
    // Get all active schedules that are due
    const dueSchedules = await db.select()
      .from(complianceMonitoringSchedules)
      .where(
        and(
          eq(complianceMonitoringSchedules.isActive, true),
          lte(complianceMonitoringSchedules.nextScheduled, new Date())
        )
      );

    // Generate new predictions for each due schedule
    for (const schedule of dueSchedules) {
      try {
        await this.generatePrediction(schedule.documentId);
        
        // Update next scheduled check
        await db.update(complianceMonitoringSchedules)
          .set({
            lastChecked: new Date(),
            nextScheduled: this.calculateNextCheck(schedule.frequency as MonitoringFrequency),
          })
          .where(eq(complianceMonitoringSchedules.id, schedule.id));
      } catch (error) {
        console.error(`Failed to process schedule ${schedule.id}:`, error);
      }
    }
  }
}

export const predictiveMonitoringService = new PredictiveMonitoringService();
