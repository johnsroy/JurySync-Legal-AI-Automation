import { db } from "../db";
import { modelMetrics } from "@shared/schema/metrics";
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

      // Get model distribution
      const modelCounts = await db
        .select({
          model: modelMetrics.modelUsed,
          count: sql<number>`count(*)::integer`,
        })
        .from(modelMetrics)
        .where(baseQuery)
        .groupBy(modelMetrics.modelUsed);

      const modelDistribution = modelCounts.reduce((acc, { model, count }) => ({
        ...acc,
        [model]: Math.round((count / totalTasks) * 100)
      }), {} as Record<string, number>);

      // Calculate average processing time
      const avgResult = await db
        .select({
          avg: sql<number>`avg(${modelMetrics.processingTimeMs})::integer`
        })
        .from(modelMetrics)
        .where(baseQuery);

      const avgProcessingTime = avgResult[0]?.avg || 0;

      // Calculate error rates per model
      const errorRates = await db
        .select({
          model: modelMetrics.modelUsed,
          errorRate: sql<number>`avg(${modelMetrics.errorRate})::float`
        })
        .from(modelMetrics)
        .where(baseQuery)
        .groupBy(modelMetrics.modelUsed);

      const errorRatesMap = errorRates.reduce((acc, { model, errorRate }) => ({
        ...acc,
        [model]: Number(errorRate || 0)
      }), {} as Record<string, number>);

      // Calculate cost savings
      const costSavings = this.calculateCostSavings(modelCounts);

      // Calculate automation metrics
      const automationMetrics = this.calculateAutomationMetrics(
        avgProcessingTime,
        errorRatesMap,
        costSavings
      );

      return {
        totalTasks,
        modelDistribution,
        averageProcessingTime: avgProcessingTime,
        errorRates: errorRatesMap,
        costSavings,
        automationMetrics
      };
    } catch (error) {
      console.error('Error collecting metrics:', error);
      throw new Error('Failed to collect metrics');
    }
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
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();