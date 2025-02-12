import { db } from "../db";
import { modelMetrics, workflowMetrics, documentMetrics, userActivityMetrics, aggregateMetrics } from "@shared/schema/metrics";
import { eq, and, sql } from "drizzle-orm";

interface ModelUsageMetrics {
  totalTasks: number;
  modelDistribution: Record<string, number>;
  averageProcessingTime: number;
  errorRates: Record<string, number>;
  costSavings: number;
  automationMetrics: {
    automationPercentage: string;
    processingTimeReduction: string;
    laborCostSavings: string;
    errorReduction: string;
  };
  modelPerformance: Array<{
    model: string;
    avgProcessingTime: number;
    errorRate: number;
    successRate: number;
  }>;
  costEfficiency: Array<{
    model: string;
    costSavings: number;
  }>;
  documentAnalysisSuccessRate: number;
  codeReviewSuccessRate: number;
  researchSuccessRate: number;
  complianceSuccessRate: number;
}

const MODEL_COSTS = {
  "claude-3-opus-20240229": 0.15,   // O3_HIGH
  "gpt-4o": 0.12,                   // GPT4O
  "claude-3-sonnet-20240229": 0.08, // O3_MINI
  "claude-instant-1.2": 0.03        // O1
} as const;

export class MetricsCollector {
  private readonly BASELINE_PROCESSING_TIME = 300000; // 5 minutes in ms
  private readonly BASELINE_ERROR_RATE = 0.4; // 40% error rate without AI
  private readonly BASELINE_COST = 0.15; // Cost per request if always using highest tier

  public async collectMetrics(timeRange?: { start: Date; end: Date }): Promise<ModelUsageMetrics> {
    try {
      // Base query for the specified time range
      const baseQuery = timeRange
        ? and(
            sql`${modelMetrics.timestamp} >= ${timeRange.start}`,
            sql`${modelMetrics.timestamp} <= ${timeRange.end}`
          )
        : undefined;

      // Get total tasks
      const totalTasksResult = await db
        .select({ count: sql<number>`count(*)::integer` })
        .from(modelMetrics)
        .where(baseQuery);

      const totalTasks = totalTasksResult[0]?.count || 0;

      // Get model distribution and performance metrics
      const modelStats = await db
        .select({
          model: modelMetrics.modelUsed,
          count: sql<number>`count(*)::integer`,
          avgProcessingTime: sql<number>`avg(${modelMetrics.processingTimeMs})::integer`,
          errorRate: sql<number>`avg(${modelMetrics.errorRate})::float`,
          taskType: modelMetrics.taskType
        })
        .from(modelMetrics)
        .where(baseQuery)
        .groupBy(modelMetrics.modelUsed, modelMetrics.taskType);

      // Calculate model distribution
      const modelDistribution = modelStats.reduce((acc, { model, count }) => ({
        ...acc,
        [model]: Math.round((count / totalTasks) * 100)
      }), {} as Record<string, number>);

      // Calculate average processing time and error rates
      const errorRates: Record<string, number> = {};
      const modelPerformance = modelStats.map(({ model, avgProcessingTime, errorRate }) => {
        errorRates[model] = errorRate || 0;
        return {
          model,
          avgProcessingTime: avgProcessingTime || 0,
          errorRate: errorRate || 0,
          successRate: 100 - ((errorRate || 0) * 100)
        };
      });

      // Calculate task-specific success rates
      const taskSuccessRates = modelStats.reduce((acc, { taskType, errorRate }) => {
        if (!acc[taskType]) {
          acc[taskType] = { total: 0, success: 0 };
        }
        acc[taskType].total++;
        acc[taskType].success += (1 - (errorRate || 0));
        return acc;
      }, {} as Record<string, { total: number; success: number }>);

      // Calculate cost savings
      const costSavings = this.calculateCostSavings(
        modelStats.map(({ model, count }) => ({ model, count }))
      );

      // Calculate cost efficiency per model
      const costEfficiency = Object.entries(MODEL_COSTS).map(([model, cost]) => ({
        model,
        costSavings: Math.round(((this.BASELINE_COST - cost) / this.BASELINE_COST) * 100)
      }));

      // Calculate automation metrics
      const avgProcessingTime = modelStats.reduce((sum, { avgProcessingTime, count }) => 
        sum + (avgProcessingTime * count), 0) / totalTasks;

      const automationMetrics = this.calculateAutomationMetrics(
        avgProcessingTime,
        errorRates,
        costSavings
      );

      return {
        totalTasks,
        modelDistribution,
        averageProcessingTime: avgProcessingTime,
        errorRates,
        costSavings,
        automationMetrics,
        modelPerformance,
        costEfficiency,
        documentAnalysisSuccessRate: this.calculateSuccessRate(taskSuccessRates['DOCUMENT_ANALYSIS']),
        codeReviewSuccessRate: this.calculateSuccessRate(taskSuccessRates['CODE_REVIEW']),
        researchSuccessRate: this.calculateSuccessRate(taskSuccessRates['RESEARCH']),
        complianceSuccessRate: this.calculateSuccessRate(taskSuccessRates['COMPLIANCE'])
      };
    } catch (error) {
      console.error('Error collecting metrics:', error);
      throw new Error('Failed to collect metrics');
    }
  }

  private calculateSuccessRate(taskStats?: { total: number; success: number }): number {
    if (!taskStats || taskStats.total === 0) return 0;
    return Math.round((taskStats.success / taskStats.total) * 100);
  }

  // Record document metrics with enhanced tracking
  public async recordDocumentMetric(data: {
    userId: number;
    documentId: string;
    documentType: string;
    processingType: string;
    startTime: Date;
    completionTime?: Date;
    pageCount?: number;
    wordCount?: number;
    processingTimeMs?: number;
    successful: boolean;
    metadata?: {
      complexity?: number;
      riskScore?: number;
      suggestions?: number;
      revisions?: number;
      templateUsed?: string;
      templateCategory?: string;
    };
  }) {
    console.log('Recording document metric:', {
      ...data,
      userId: '[REDACTED]', // Don't log sensitive data
    });

    await db.insert(documentMetrics).values(data);
  }

  private calculateCostSavings(modelCounts: Array<{ model: string; count: number }>): number {
    // Calculate actual cost
    const actualCost = modelCounts.reduce((total, { model, count }) => {
      const cost = MODEL_COSTS[model as keyof typeof MODEL_COSTS] || 0;
      return total + (count * cost);
    }, 0);

    // Calculate baseline cost (if all tasks used highest tier model)
    const totalTasks = modelCounts.reduce((sum, { count }) => sum + count, 0);
    const baselineCost = totalTasks * this.BASELINE_COST;

    // Return savings percentage
    return Math.round(((baselineCost - actualCost) / baselineCost) * 100);
  }

  private calculateAutomationMetrics(
    avgProcessingTime: number,
    errorRates: Record<string, number>,
    costSavings: number
  ) {
    // Calculate processing time reduction
    const timeReduction = ((this.BASELINE_PROCESSING_TIME - avgProcessingTime) / this.BASELINE_PROCESSING_TIME) * 100;

    // Calculate average error rate
    const avgErrorRate = Object.values(errorRates).reduce((sum, rate) => sum + rate, 0) /
      Math.max(1, Object.values(errorRates).length);
    const errorReduction = ((this.BASELINE_ERROR_RATE - avgErrorRate) / this.BASELINE_ERROR_RATE) * 100;

    // Calculate labor cost savings (estimated based on time savings and error reduction)
    const laborSavingsLow = Math.round((timeReduction + errorReduction) / 3);
    const laborSavingsHigh = Math.round((timeReduction + errorReduction) / 2);

    return {
      automationPercentage: `${Math.round(100 - avgErrorRate * 100)}%`,
      processingTimeReduction: `${Math.round(timeReduction)}%`,
      laborCostSavings: `${laborSavingsLow}-${laborSavingsHigh}%`,
      errorReduction: `${Math.round(errorReduction)}%`
    };
  }

  // Record model metrics
  public async recordModelMetric(data: {
    userId: number;
    taskId: string;
    modelUsed: string;
    taskType: string;
    processingTimeMs: number;
    tokenCount: number;
    errorRate?: number;
    qualityScore?: number;
    metadata?: {
      promptTokens?: number;
      completionTokens?: number;
      totalCost?: number;
      modelCapabilities?: string[];
    };
  }) {
    await db.insert(modelMetrics).values(data);
  }

  // Record workflow metrics
  public async recordWorkflowMetric(data: {
    userId: number;
    workflowId: string;
    workflowType: string;
    status: string;
    startTime: Date;
    completionTime?: Date;
    processingTimeMs?: number;
    successful: boolean;
    errorMessage?: string;
    metadata?: {
      stepsCompleted?: string[];
      automationRate?: number;
      efficiency?: number;
      costSavings?: number;
      templateUsed?: string;
      templateCategory?: string;
    };
  }) {
    await db.insert(workflowMetrics).values(data);
  }

  // User activity metrics
  public async recordUserActivity(data: {
    userId: number;
    activityType: string;
    resourceType?: string;
    resourceId?: string;
    actionResult: string;
    metadata?: {
      duration?: number;
      interactionType?: string;
      features?: string[];
      success?: boolean;
    };
  }) {
    await db.insert(userActivityMetrics).values(data);
  }

  // Aggregate metrics for dashboard
  public async recordAggregateMetric(data: {
    userId: number;
    metricType: string;
    timeframe: string;
    value: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    await db.insert(aggregateMetrics).values(data);
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();