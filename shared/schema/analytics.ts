import { pgTable, serial, text, timestamp, integer, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const analyticsData = pgTable('analytics_data', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow(),
  modelId: text('model_id'),
  documentId: text('document_id'),
  taskType: text('task_type'),
  processingTime: integer('processing_time'),
  successRate: real('success_rate'),
  costSavings: real('cost_savings'),
  errorRate: real('error_rate'),
  metadata: jsonb('metadata').$type<{
    documentType?: string;
    complexity?: number;
    suggestions?: number;
    templateUsed?: string;
    modelCapabilities?: string[];
  }>(),
});

export const modelAnalytics = pgTable('model_analytics', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow(),
  modelId: text('model_id'),
  totalRequests: integer('total_requests'),
  avgProcessingTime: integer('avg_processing_time'),
  successRate: real('success_rate'),
  costPerRequest: real('cost_per_request'),
  aggregatedScore: real('aggregated_score'),
  metadata: jsonb('metadata').$type<{
    capabilities?: string[];
    specializations?: string[];
    performanceMetrics?: Record<string, number>;
  }>(),
});

export const workflowAnalytics = pgTable('workflow_analytics', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow(),
  workflowId: text('workflow_id'),
  workflowType: text('workflow_type'),
  totalSteps: integer('total_steps'),
  completedSteps: integer('completed_steps'),
  processingTime: integer('processing_time'),
  successRate: real('success_rate'),
  metadata: jsonb('metadata').$type<{
    stepsBreakdown?: Record<string, number>;
    automationRate?: number;
    costSavings?: number;
  }>(),
});

export type AnalyticsData = typeof analyticsData.$inferSelect;
export type InsertAnalyticsData = typeof analyticsData.$inferInsert;

export type ModelAnalytics = typeof modelAnalytics.$inferSelect;
export type InsertModelAnalytics = typeof modelAnalytics.$inferInsert;

export type WorkflowAnalytics = typeof workflowAnalytics.$inferSelect;
export type InsertWorkflowAnalytics = typeof workflowAnalytics.$inferInsert;

export const insertAnalyticsSchema = createInsertSchema(analyticsData);
export const insertModelAnalyticsSchema = createInsertSchema(modelAnalytics);
export const insertWorkflowAnalyticsSchema = createInsertSchema(workflowAnalytics);
