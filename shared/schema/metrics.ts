import { pgTable, serial, text, timestamp, integer, real, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Model metrics table
export const modelMetrics = pgTable('model_metrics', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  taskId: text('task_id').notNull(),
  modelUsed: text('model_used').notNull(),
  taskType: text('task_type').notNull(),
  processingTimeMs: integer('processing_time_ms').notNull(),
  tokenCount: integer('token_count').notNull(),
  errorRate: real('error_rate'),
  qualityScore: real('quality_score'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metadata: jsonb('metadata').$type<{
    promptTokens?: number;
    completionTokens?: number;
    totalCost?: number;
    modelCapabilities?: string[];
  }>(),
});

// Workflow metrics table
export const workflowMetrics = pgTable('workflow_metrics', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  workflowId: text('workflow_id').notNull(),
  workflowType: text('workflow_type').notNull(),
  status: text('status').notNull(),
  startTime: timestamp('start_time').notNull(),
  completionTime: timestamp('completion_time'),
  processingTimeMs: integer('processing_time_ms'),
  successful: boolean('successful').notNull(),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata').$type<{
    stepsCompleted?: string[];
    automationRate?: number;
    efficiency?: number;
    costSavings?: number;
  }>(),
});

// Document processing metrics
export const documentMetrics = pgTable('document_metrics', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  documentId: text('document_id').notNull(),
  documentType: text('document_type').notNull(),
  processingType: text('processing_type').notNull(),
  startTime: timestamp('start_time').notNull(),
  completionTime: timestamp('completion_time'),
  pageCount: integer('page_count'),
  wordCount: integer('word_count'),
  processingTimeMs: integer('processing_time_ms'),
  successful: boolean('successful').notNull(),
  metadata: jsonb('metadata').$type<{
    complexity?: number;
    riskScore?: number;
    suggestions?: number;
    revisions?: number;
  }>(),
});

// User activity metrics
export const userActivityMetrics = pgTable('user_activity_metrics', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  activityType: text('activity_type').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  actionResult: text('action_result').notNull(),
  metadata: jsonb('metadata').$type<{
    duration?: number;
    interactionType?: string;
    features?: string[];
    success?: boolean;
  }>(),
});

// Aggregate metrics for dashboard
export const aggregateMetrics = pgTable('aggregate_metrics', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  metricType: text('metric_type').notNull(),
  timeframe: text('timeframe').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  value: jsonb('value').$type<{
    riskDistribution?: Record<string, number>;
    averageRiskScore?: number;
    trends?: {
      riskScoreTrend: number;
      complianceRateTrend: number;
    };
    modelDistribution?: Record<string, number>;
    performanceMetrics?: {
      processingTime: number;
      errorRate: number;
      costSavings: number;
    };
  }>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
});

// Metrics Events table for tracking various operations
export const metricsEvents = pgTable('metrics_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  modelId: text('model_id').notNull(),
  taskType: text('task_type').notNull(),
  processingTimeMs: integer('processing_time_ms').notNull(),
  successful: boolean('successful').notNull(),
  costSavingEstimate: real('cost_saving_estimate').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metadata: jsonb('metadata').$type<{
    error?: string;
    details?: Record<string, unknown>;
  }>(),
});

// Create insert schemas
export const insertModelMetricsSchema = createInsertSchema(modelMetrics, {
  timestamp: z.coerce.date().optional(),
});

export const insertWorkflowMetricsSchema = createInsertSchema(workflowMetrics, {
  startTime: z.coerce.date(),
  completionTime: z.coerce.date().optional(),
});

export const insertDocumentMetricsSchema = createInsertSchema(documentMetrics, {
  startTime: z.coerce.date(),
  completionTime: z.coerce.date().optional(),
});

export const insertUserActivityMetricsSchema = createInsertSchema(userActivityMetrics, {
  timestamp: z.coerce.date().optional(),
});

export const insertAggregateMetricsSchema = createInsertSchema(aggregateMetrics, {
  timestamp: z.coerce.date().optional(),
});

export const insertMetricsEventSchema = createInsertSchema(metricsEvents, {
  timestamp: z.coerce.date().optional(),
});

// Export types
export type ModelMetric = typeof modelMetrics.$inferSelect;
export type WorkflowMetric = typeof workflowMetrics.$inferSelect;
export type DocumentMetric = typeof documentMetrics.$inferSelect;
export type UserActivityMetric = typeof userActivityMetrics.$inferSelect;
export type AggregateMetric = typeof aggregateMetrics.$inferSelect;
export type MetricsEvent = typeof metricsEvents.$inferSelect;

export type InsertModelMetric = z.infer<typeof insertModelMetricsSchema>;
export type InsertWorkflowMetric = z.infer<typeof insertWorkflowMetricsSchema>;
export type InsertDocumentMetric = z.infer<typeof insertDocumentMetricsSchema>;
export type InsertUserActivityMetric = z.infer<typeof insertUserActivityMetricsSchema>;
export type InsertAggregateMetric = z.infer<typeof insertAggregateMetricsSchema>;
export type InsertMetricsEvent = z.infer<typeof insertMetricsEventSchema>;