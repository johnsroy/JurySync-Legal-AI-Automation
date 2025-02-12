import { ChromaClient, Collection } from "chromadb";
import { db } from "../db";
import { analyticsData, modelAnalytics, workflowAnalytics } from "@shared/schema/analytics";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { subDays } from "date-fns";

// Model costs for calculating efficiency
const MODEL_COSTS = {
  "claude-3-opus-20240229": 0.15,
  "gpt-4o": 0.12,
  "claude-3-sonnet-20240229": 0.08
} as const;

interface TimeRange {
  start: Date;
  end: Date;
}

export class AnalyticsService {
  private chromaClient: ChromaClient;
  private modelMetricsCollection: Collection;
  private initialized = false;

  constructor() {
    this.chromaClient = new ChromaClient();
    this.initialize();
  }

  private async initialize() {
    if (this.initialized) return;

    try {
      this.modelMetricsCollection = await this.chromaClient.createCollection({
        name: "model_metrics",
        metadata: { description: "Model performance metrics and embeddings" }
      });

      // Initialize default records if none exist
      const existingData = await db
        .select()
        .from(analyticsData)
        .limit(1);

      if (existingData.length === 0) {
        await this.seedInitialData();
      }

      this.initialized = true;
      console.log("AnalyticsService initialized successfully");
    } catch (error) {
      console.error("Failed to initialize AnalyticsService:", error);
      throw error;
    }
  }

  private async seedInitialData() {
    const now = new Date();
    const defaultData = {
      modelId: "gpt-4o",
      documentId: "sample",
      taskType: "analysis",
      processingTime: 500,
      successRate: 0.95,
      costSavings: 120.50,
      errorRate: 0.05,
      metadata: {
        documentType: "contract",
        complexity: 0.7,
        suggestions: 5,
        templateUsed: "standard",
        modelCapabilities: ["text-analysis", "risk-assessment"]
      }
    };

    await db.insert(analyticsData).values(defaultData);
  }

  async recordMetrics(data: {
    modelId: string;
    taskType: string;
    processingTimeMs: number;
    successRate: number;
    costSavings: number;
    metadata?: Record<string, any>;
  }) {
    try {
      // Store in PostgreSQL
      const [record] = await db.insert(analyticsData).values({
        ...data,
        timestamp: new Date(),
        errorRate: 1 - data.successRate
      }).returning();

      // Store in ChromaDB for semantic search
      await this.modelMetricsCollection.add({
        ids: [`${data.modelId}_${Date.now()}`],
        metadatas: [{
          modelId: data.modelId,
          taskType: data.taskType,
          timestamp: new Date().toISOString()
        }],
        documents: [JSON.stringify(data)]
      });

      return record;
    } catch (error) {
      console.error("Failed to record metrics:", error);
      throw error;
    }
  }

  async getAnalytics(timeRange: TimeRange) {
    const { start, end } = timeRange;

    // Get analytics data with aggregations
    const metrics = await db
      .select({
        totalDocuments: sql<number>`count(distinct ${analyticsData.documentId})::integer`,
        avgProcessingTime: sql<number>`avg(${analyticsData.processingTime})::float`,
        avgSuccessRate: sql<number>`avg(${analyticsData.successRate})::float`,
        totalCostSavings: sql<number>`sum(${analyticsData.costSavings})::float`,
      })
      .from(analyticsData)
      .where(
        and(
          gte(analyticsData.timestamp, start),
          lte(analyticsData.timestamp, end)
        )
      );

    // Get model distribution
    const modelDistribution = await db
      .select({
        modelId: analyticsData.modelId,
        count: sql<number>`count(*)::integer`,
      })
      .from(analyticsData)
      .where(
        and(
          gte(analyticsData.timestamp, start),
          lte(analyticsData.timestamp, end)
        )
      )
      .groupBy(analyticsData.modelId);

    // Get workflow performance
    const workflowMetrics = await db
      .select({
        workflowId: workflowAnalytics.workflowId,
        avgSuccessRate: sql<number>`avg(${workflowAnalytics.successRate})::float`,
        totalSteps: sql<number>`sum(${workflowAnalytics.totalSteps})::integer`,
      })
      .from(workflowAnalytics)
      .where(
        and(
          gte(workflowAnalytics.timestamp, start),
          lte(workflowAnalytics.timestamp, end)
        )
      )
      .groupBy(workflowAnalytics.workflowId);

    const [baseMetrics] = metrics;

    return {
      automationMetrics: {
        automationPercentage: `${((baseMetrics.avgSuccessRate || 0) * 100).toFixed(1)}%`,
        processingTimeReduction: `${(100 - (baseMetrics.avgProcessingTime || 0) / 1000).toFixed(1)}%`,
        laborCostSavings: `$${Math.round(baseMetrics.totalCostSavings || 0).toLocaleString()}`,
        errorReduction: `${((1 - (1 - (baseMetrics.avgSuccessRate || 0))) * 100).toFixed(1)}%`
      },
      modelDistribution: modelDistribution.map(m => ({
        name: m.modelId,
        value: m.count
      })),
      workflowEfficiency: workflowMetrics.map(w => ({
        name: w.workflowId,
        successRate: Math.round((w.avgSuccessRate || 0) * 100),
        totalSteps: w.totalSteps
      })),
      documentActivity: await this.getDocumentActivity(start, end)
    };
  }

  private async getDocumentActivity(start: Date, end: Date) {
    const activity = await db
      .select({
        date: sql`date_trunc('day', ${analyticsData.timestamp})::date`,
        processed: sql<number>`count(*)::integer`,
      })
      .from(analyticsData)
      .where(
        and(
          gte(analyticsData.timestamp, start),
          lte(analyticsData.timestamp, end)
        )
      )
      .groupBy(sql`date_trunc('day', ${analyticsData.timestamp})`)
      .orderBy(sql`date_trunc('day', ${analyticsData.timestamp})`);

    return activity.map(a => ({
      date: a.date.toISOString().split('T')[0],
      processed: a.processed,
      uploaded: Math.round(a.processed * 0.8) // Simplified metric for demo
    }));
  }
}

export const analyticsService = new AnalyticsService();