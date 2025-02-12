import { ChromaClient, Collection } from "chromadb";
import { db } from "../db";
import { analyticsData, modelAnalytics, workflowAnalytics } from "@shared/schema/analytics";
import { eq, and, gte, lte } from "drizzle-orm";
import { subDays } from "date-fns";

interface AnalyticsTimeRange {
  start: Date;
  end: Date;
}

class AnalyticsService {
  private chromaClient: ChromaClient;
  private modelMetricsCollection: Collection;

  constructor() {
    this.chromaClient = new ChromaClient();
    this.initialize();
  }

  private async initialize() {
    try {
      this.modelMetricsCollection = await this.chromaClient.createCollection({
        name: "model_metrics",
        metadata: { description: "Storage for model performance metrics and embeddings" }
      });

      // Seed initial data if none exists
      const existingData = await db.select().from(modelAnalytics).limit(1);
      if (existingData.length === 0) {
        await this.seedInitialData();
      }
    } catch (error) {
      console.error("Failed to initialize ChromaDB:", error);
      throw error;
    }
  }

  private async seedInitialData() {
    const models = ["claude-3-opus-20240229", "gpt-4o", "claude-3-sonnet-20240229"];
    const now = new Date();

    for (const modelId of models) {
      // Add model analytics data
      await db.insert(modelAnalytics).values({
        modelId,
        timestamp: now,
        totalRequests: Math.floor(Math.random() * 1000) + 500,
        avgProcessingTime: Math.floor(Math.random() * 2000) + 1000,
        successRate: 0.85 + Math.random() * 0.1,
        costPerRequest: 0.05 + Math.random() * 0.1,
        aggregatedScore: 0.8 + Math.random() * 0.15,
        metadata: {
          capabilities: ["document_analysis", "code_review", "legal_research"],
          specializations: ["contract_review", "compliance_audit"],
          performanceMetrics: {
            accuracy: 0.9 + Math.random() * 0.05,
            latency: Math.floor(Math.random() * 100) + 50
          }
        }
      });

      // Add workflow analytics data
      await db.insert(workflowAnalytics).values({
        workflowId: `wf_${Date.now()}`,
        workflowType: ["CONTRACT_REVIEW", "COMPLIANCE_AUDIT", "LEGAL_RESEARCH"][Math.floor(Math.random() * 3)],
        timestamp: now,
        totalSteps: Math.floor(Math.random() * 5) + 5,
        completedSteps: Math.floor(Math.random() * 4) + 4,
        processingTime: Math.floor(Math.random() * 3000) + 1000,
        successRate: 0.8 + Math.random() * 0.15,
        metadata: {
          stepsBreakdown: { analysis: 2, review: 2, approval: 1 },
          automationRate: 0.75 + Math.random() * 0.2,
          costSavings: Math.floor(Math.random() * 30) + 20
        }
      });

      // Store embeddings in ChromaDB
      await this.modelMetricsCollection.add({
        ids: [`${modelId}_${Date.now()}`],
        embeddings: [[Math.random(), Math.random(), Math.random()]],
        metadatas: [{
          modelId,
          timestamp: now.toISOString(),
          performanceMetrics: {
            accuracy: 0.9 + Math.random() * 0.05,
            latency: Math.floor(Math.random() * 100) + 50
          }
        }]
      });
    }
  }

  async getAggregatedMetrics(timeRange: AnalyticsTimeRange) {
    const { start, end } = timeRange;

    // Get model performance data
    const modelPerformance = await db
      .select({
        modelId: modelAnalytics.modelId,
        avgProcessingTime: modelAnalytics.avgProcessingTime,
        successRate: modelAnalytics.successRate,
        costPerRequest: modelAnalytics.costPerRequest
      })
      .from(modelAnalytics)
      .where(
        and(
          gte(modelAnalytics.timestamp, start),
          lte(modelAnalytics.timestamp, end)
        )
      );

    // Get workflow metrics
    const workflowMetrics = await db
      .select()
      .from(workflowAnalytics)
      .where(
        and(
          gte(workflowAnalytics.timestamp, start),
          lte(workflowAnalytics.timestamp, end)
        )
      );

    // Calculate model distribution
    const modelDistribution = await this.calculateModelDistribution(timeRange);

    // Get similar documents using ChromaDB
    const recentEmbeddings = await this.modelMetricsCollection.query({
      nResults: 5,
      where: {
        timestamp: { $gte: start.toISOString() }
      }
    });

    return {
      modelPerformance: modelPerformance.map(model => ({
        model: model.modelId,
        avgProcessingTime: model.avgProcessingTime,
        successRate: model.successRate * 100,
        costEfficiency: (1 - (model.costPerRequest || 0)) * 100
      })),
      workflowEfficiency: workflowMetrics.map(wf => ({
        name: wf.workflowType,
        successRate: wf.successRate * 100,
        avgProcessingTime: wf.processingTime,
        automationRate: wf.metadata?.automationRate || 0
      })),
      modelDistribution,
      similarPatterns: recentEmbeddings.metadatas?.map(metadata => ({
        timestamp: metadata.timestamp,
        metrics: metadata.performanceMetrics
      }))
    };
  }

  private async calculateModelDistribution(timeRange: AnalyticsTimeRange) {
    const { start, end } = timeRange;

    const modelCounts = await db
      .select({
        modelId: analyticsData.modelId,
        count: sql<number>`count(*)::integer`
      })
      .from(analyticsData)
      .where(
        and(
          gte(analyticsData.timestamp, start),
          lte(analyticsData.timestamp, end)
        )
      )
      .groupBy(analyticsData.modelId);

    const total = modelCounts.reduce((sum, { count }) => sum + count, 0);

    return modelCounts.map(({ modelId, count }) => ({
      name: modelId,
      value: Math.round((count / total) * 100)
    }));
  }
}

export const analyticsService = new AnalyticsService();