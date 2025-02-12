import { pgTable, serial, text, timestamp, integer, real, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Model metrics table - tracking individual model usage and performance
export const modelMetrics = pgTable('model_metrics', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  modelId: text('model_id').notNull(),
  taskType: text('task_type').notNull(),
  processingTimeMs: integer('processing_time_ms').notNull(),
  tokenCount: integer('token_count').notNull(),
  successRate: real('success_rate').notNull(),
  costPerRequest: real('cost_per_request').notNull(),
  errorRate: real('error_rate'),
  metadata: jsonb('metadata').$type<{
    promptTokens?: number;
    completionTokens?: number;
    totalCost?: number;
    capabilities?: string[];
    performance?: Record<string, number>;
  }>(),
});

// Workflow metrics table - tracking workflow execution and efficiency
export const workflowMetrics = pgTable('workflow_metrics', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  workflowId: text('workflow_id').notNull(),
  workflowType: text('workflow_type').notNull(),
  modelUsed: text('model_used').notNull(),
  totalSteps: integer('total_steps').notNull(),
  completedSteps: integer('completed_steps').notNull(),
  processingTime: integer('processing_time').notNull(),
  successRate: real('success_rate').notNull(),
  metadata: jsonb('metadata').$type<{
    stepsBreakdown?: Record<string, number>;
    automationRate?: number;
    costSavings?: number;
    performance?: Record<string, number>;
  }>(),
});

// Aggregate metrics for analytics dashboard
export const aggregateMetrics = pgTable('aggregate_metrics', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metricType: text('metric_type').notNull(),
  timeframe: text('timeframe').notNull(),
  value: jsonb('value').$type<{
    modelDistribution?: Record<string, number>;
    successRates?: Record<string, number>;
    processingTimes?: Record<string, number>;
    costEfficiency?: Record<string, number>;
    trends?: {
      performance: number;
      efficiency: number;
      costSavings: number;
    };
  }>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
});

// Create insert schemas with validation
export const insertModelMetricsSchema = createInsertSchema(modelMetrics);
export const insertWorkflowMetricsSchema = createInsertSchema(workflowMetrics);
export const insertAggregateMetricsSchema = createInsertSchema(aggregateMetrics);

// Export types
export type ModelMetric = typeof modelMetrics.$inferSelect;
export type WorkflowMetric = typeof workflowMetrics.$inferSelect;
export type AggregateMetric = typeof aggregateMetrics.$inferSelect;

export type InsertModelMetric = z.infer<typeof insertModelMetricsSchema>;
export type InsertWorkflowMetric = z.infer<typeof insertWorkflowMetricsSchema>;
export type InsertAggregateMetric = z.infer<typeof insertAggregateMetricsSchema>;