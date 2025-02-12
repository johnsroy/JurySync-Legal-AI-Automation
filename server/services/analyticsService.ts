import { ChromaClient, Collection } from "chromadb";
import { db } from "../db";
import { modelMetrics, workflowMetrics, aggregateMetrics } from "@shared/schema/metrics";
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

      // Check if we need to seed data
      const existingData = await db
        .select()
        .from(modelMetrics)
        .limit(1);

      if (existingData.length === 0) {
        // Import the seed function
        const { seedAnalyticsData } = await import('./seedData');
        await seedAnalyticsData();
      }

      this.initialized = true;
      console.log("AnalyticsService initialized successfully");
    } catch (error) {
      console.error("Failed to initialize ChromaDB:", error);
      throw error;
    }
  }

  async recordModelMetrics(data: {
    modelId: string;
    taskType: string;
    processingTimeMs: number;
    tokenCount: number;
    successRate: number;
    costPerRequest: number;
    errorRate?: number;
    metadata?: Record<string, any>;
  }) {
    try {
      // Store in PostgreSQL for structured queries
      await db.insert(modelMetrics).values({
        ...data,
        timestamp: new Date()
      });

      // Store in ChromaDB for semantic search
      if (this.modelMetricsCollection) {
        await this.modelMetricsCollection.add({
          ids: [`${data.modelId}_${Date.now()}`],
          embeddings: [this.generateMetricsEmbedding(data)],
          metadatas: [{
            ...data,
            timestamp: new Date().toISOString()
          }]
        });
      }

      return true;
    } catch (error) {
      console.error("Failed to record model metrics:", error);
      return false;
    }
  }

  private generateMetricsEmbedding(data: Record<string, any>): number[] {
    // Convert metrics to vector representation for similarity search
    return [
      data.successRate || 0,
      data.errorRate || 0,
      data.processingTimeMs / 1000, // Normalize to seconds
      data.costPerRequest || 0,
      data.tokenCount / 1000 // Normalize token count
    ];
  }

  async getAnalytics(timeRange: TimeRange) {
    const { start, end } = timeRange;

    // Get model performance metrics
    const modelPerformance = await db
      .select({
        modelId: modelMetrics.modelId,
        avgProcessingTime: sql<number>`avg(${modelMetrics.processingTimeMs})::float`,
        avgSuccessRate: sql<number>`avg(${modelMetrics.successRate})::float`,
        avgCostPerRequest: sql<number>`avg(${modelMetrics.costPerRequest})::float`,
        totalRequests: sql<number>`count(*)::integer`
      })
      .from(modelMetrics)
      .where(
        and(
          gte(modelMetrics.timestamp, start),
          lte(modelMetrics.timestamp, end)
        )
      )
      .groupBy(modelMetrics.modelId);

    // Get workflow efficiency metrics
    const workflowEfficiency = await db
      .select({
        workflowType: workflowMetrics.workflowType,
        avgSuccessRate: sql<number>`avg(${workflowMetrics.successRate})::float`,
        avgProcessingTime: sql<number>`avg(${workflowMetrics.processingTime})::float`,
        automationRate: sql<number>`avg((${workflowMetrics.metadata}->>'automationRate')::float)::float`
      })
      .from(workflowMetrics)
      .where(
        and(
          gte(workflowMetrics.timestamp, start),
          lte(workflowMetrics.timestamp, end)
        )
      )
      .groupBy(workflowMetrics.workflowType);

    // Calculate cost efficiency
    const costEfficiency = modelPerformance.map(model => ({
      model: model.modelId,
      costSavings: this.calculateCostSavings(model.avgCostPerRequest)
    }));

    // Store aggregated metrics
    await this.storeAggregatedMetrics({
      modelPerformance,
      workflowEfficiency,
      costEfficiency,
      timeRange
    });

    return {
      modelPerformance: modelPerformance.map(model => ({
        model: model.modelId,
        successRate: Math.round(model.avgSuccessRate * 100),
        processingTime: Math.round(model.avgProcessingTime),
        costEfficiency: Math.round((1 - model.avgCostPerRequest) * 100)
      })),
      workflowEfficiency: workflowEfficiency.map(wf => ({
        name: wf.workflowType,
        successRate: Math.round(wf.avgSuccessRate * 100),
        processingTime: Math.round(wf.avgProcessingTime),
        automationRate: Math.round(wf.automationRate * 100)
      })),
      costEfficiency,
      automationMetrics: this.calculateAutomationMetrics(modelPerformance, workflowEfficiency)
    };
  }

  private calculateCostSavings(actualCost: number): number {
    const baselineCost = Math.max(...Object.values(MODEL_COSTS));
    return Math.round(((baselineCost - actualCost) / baselineCost) * 100);
  }

  private calculateAutomationMetrics(
    modelPerformance: any[],
    workflowEfficiency: any[]
  ) {
    const avgSuccessRate = modelPerformance.reduce((sum, m) => sum + m.avgSuccessRate, 0) / modelPerformance.length;
    const avgAutomationRate = workflowEfficiency.reduce((sum, w) => sum + w.automationRate, 0) / workflowEfficiency.length;

    return {
      automationPercentage: `${Math.round(avgAutomationRate * 100)}%`,
      processingTimeReduction: `${Math.round((1 - avgSuccessRate) * 100)}%`,
      laborCostSavings: `${Math.round(avgAutomationRate * 80)}-${Math.round(avgAutomationRate * 90)}%`,
      errorReduction: `${Math.round(avgSuccessRate * 100)}%`
    };
  }

  private async storeAggregatedMetrics(data: {
    modelPerformance: any[];
    workflowEfficiency: any[];
    costEfficiency: any[];
    timeRange: TimeRange;
  }) {
    const { modelPerformance, workflowEfficiency, costEfficiency, timeRange } = data;

    await db.insert(aggregateMetrics).values({
      timestamp: new Date(),
      metricType: 'performance_summary',
      timeframe: `${timeRange.start.toISOString()}_${timeRange.end.toISOString()}`,
      value: {
        modelDistribution: Object.fromEntries(
          modelPerformance.map(m => [m.modelId, m.totalRequests])
        ),
        successRates: Object.fromEntries(
          modelPerformance.map(m => [m.modelId, m.avgSuccessRate])
        ),
        processingTimes: Object.fromEntries(
          modelPerformance.map(m => [m.modelId, m.avgProcessingTime])
        ),
        costEfficiency: Object.fromEntries(
          costEfficiency.map(c => [c.model, c.costSavings])
        )
      }
    });
  }
}

export const analyticsService = new AnalyticsService();