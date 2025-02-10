import { pgTable, serial, text, timestamp, integer, real } from "drizzle-orm/pg-core";

export const modelMetrics = pgTable('model_metrics', {
  id: serial('id').primaryKey(),
  taskId: text('task_id').notNull(),
  modelUsed: text('model_used').notNull(),
  taskType: text('task_type').notNull(),
  processingTimeMs: integer('processing_time_ms').notNull(),
  tokenCount: integer('token_count').notNull(),
  errorRate: real('error_rate'),
  qualityScore: real('quality_score'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metadata: text('metadata'), // JSON string for additional data
});

export type ModelMetric = typeof modelMetrics.$inferSelect;
export type InsertModelMetric = typeof modelMetrics.$inferInsert;
