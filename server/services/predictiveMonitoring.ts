import { db } from "../db";
import { InsertPrediction, InsertAlert, MonitoringFrequency, PredictionConfidence } from "@shared/schema";
import { complianceDocuments, compliancePredictions, complianceAlerts, complianceMonitoringSchedules } from "@shared/schema";
import { eq, and, lte } from "drizzle-orm";
import { Anthropic } from "@anthropic-ai/sdk";

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Enhanced logging function
function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [PredictiveMonitoring] [${type.toUpperCase()}] ${message}`, context ? context : '');
}

export class PredictiveMonitoringService {
  async scheduleMonitoring(documentId: number, frequency: MonitoringFrequency) {
    log(`Scheduling monitoring for document ${documentId} with frequency ${frequency}`);
    const nextCheck = this.calculateNextCheck(frequency);

    try {
      const [schedule] = await db.insert(complianceMonitoringSchedules)
        .values({
          documentId,
          frequency,
          nextScheduled: nextCheck,
          isActive: true,
        })
        .returning();

      log(`Successfully scheduled monitoring`, 'info', { schedule });
      return schedule;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Failed to schedule monitoring`, 'error', { error: errorMessage });
      throw new Error(`Failed to schedule monitoring: ${errorMessage}`);
    }
  }

  async generatePrediction(documentId: number): Promise<InsertPrediction> {
    log(`Generating prediction for document ${documentId}`);

    // Get document content
    const [document] = await db.select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.id, documentId));

    if (!document) {
      log(`Document not found`, 'error', { documentId });
      throw new Error("Document not found");
    }

    try {
      log('Initiating AI analysis');
      const message = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Analyze this document for potential compliance risks and provide a prediction:

          ${document.content}

          Analyze the document focusing on:
          1. Compliance status (COMPLIANT/AT_RISK/NON_COMPLIANT)
          2. Confidence level (HIGH/MEDIUM/LOW)
          3. Risk factors with impact scores
          4. Required actions with priorities and deadlines

          Format your response as a JSON object.`
        }]
      });

      log('AI analysis completed, parsing response');
      const analysis = JSON.parse(message.content[0].text);

      const prediction: InsertPrediction = {
        documentId,
        predictedStatus: analysis.status,
        confidence: analysis.confidence as PredictionConfidence,
        riskFactors: analysis.riskFactors,
        suggestedActions: analysis.suggestedActions,
        deadline: analysis.suggestedActions.find((a: any) => a.deadline)?.deadline,
      };

      // Save prediction
      log('Saving prediction to database');
      const [savedPrediction] = await db.insert(compliancePredictions)
        .values(prediction)
        .returning();

      // Generate alerts for high-risk factors
      const highRiskFactors = analysis.riskFactors.filter((rf: any) => rf.impact > 75);

      if (highRiskFactors.length > 0) {
        log(`Creating alerts for ${highRiskFactors.length} high-risk factors`);
        await this.createAlerts(savedPrediction.id, documentId, highRiskFactors);
      }

      log('Prediction generation completed successfully');
      return prediction;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('Failed to generate prediction', 'error', { error: errorMessage });
      throw new Error(`Failed to generate prediction: ${errorMessage}`);
    }
  }

  private async createAlerts(predictionId: number, documentId: number, riskFactors: any[]): Promise<void> {
    try {
      log(`Creating alerts for prediction ${predictionId}`);
      const alerts = riskFactors.map(rf => ({
        predictionId,
        documentId,
        severity: 'HIGH',
        message: `High risk detected: ${rf.factor} (Impact Score: ${rf.impact}) - ${rf.description}`,
        status: 'PENDING'
      }));

      await db.insert(complianceAlerts)
        .values(alerts);

      log(`Successfully created ${alerts.length} alerts`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('Failed to create alerts', 'error', { error: errorMessage });
      throw new Error(`Failed to create alerts: ${errorMessage}`);
    }
  }

  private calculateNextCheck(frequency: MonitoringFrequency): Date {
    const now = new Date();
    let nextCheck: Date;

    switch (frequency) {
      case "REALTIME":
        nextCheck = now;
        break;
      case "HOURLY":
        nextCheck = new Date(now.setHours(now.getHours() + 1));
        break;
      case "DAILY":
        nextCheck = new Date(now.setDate(now.getDate() + 1));
        break;
      case "WEEKLY":
        nextCheck = new Date(now.setDate(now.getDate() + 7));
        break;
      case "MONTHLY":
        nextCheck = new Date(now.setMonth(now.getMonth() + 1));
        break;
      default:
        nextCheck = new Date(now.setDate(now.getDate() + 1)); // Default to daily
    }

    log(`Calculated next check time`, 'debug', { frequency, nextCheck });
    return nextCheck;
  }

  async checkScheduledMonitoring(): Promise<void> {
    log('Starting scheduled monitoring check');

    try {
      // Get all active schedules that are due
      const dueSchedules = await db.select()
        .from(complianceMonitoringSchedules)
        .where(
          and(
            eq(complianceMonitoringSchedules.isActive, true),
            lte(complianceMonitoringSchedules.nextScheduled, new Date())
          )
        );

      log(`Found ${dueSchedules.length} schedules due for monitoring`);

      // Generate new predictions for each due schedule
      for (const schedule of dueSchedules) {
        try {
          log(`Processing schedule ${schedule.id} for document ${schedule.documentId}`);
          await this.generatePrediction(schedule.documentId);

          // Update next scheduled check
          await db.update(complianceMonitoringSchedules)
            .set({
              lastChecked: new Date(),
              nextScheduled: this.calculateNextCheck(schedule.frequency as MonitoringFrequency),
            })
            .where(eq(complianceMonitoringSchedules.id, schedule.id));

          log(`Successfully processed schedule ${schedule.id}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log(`Failed to process schedule ${schedule.id}`, 'error', { error: errorMessage });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('Failed to check scheduled monitoring', 'error', { error: errorMessage });
      throw new Error(`Failed to check scheduled monitoring: ${errorMessage}`);
    }
  }
}

export const predictiveMonitoringService = new PredictiveMonitoringService();