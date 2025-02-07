import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { integer, pgEnum, pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

// Report Types Enum
export const reportTypeEnum = pgEnum('report_type', [
  'COMPLIANCE_SUMMARY',
  'RISK_ANALYSIS',
  'CONTRACT_STATISTICS',
  'CUSTOM'
]);

// Report Status Enum
export const reportStatusEnum = pgEnum('report_status', [
  'DRAFT',
  'GENERATING',
  'COMPLETED',
  'ERROR'
]);

// Reports Table
export const reports = pgTable('reports', {
  id: integer('id').primaryKey().notNull(),
  title: text('title').notNull(),
  type: reportTypeEnum('type').notNull(),
  status: reportStatusEnum('status').default('DRAFT').notNull(),
  config: jsonb('config').$type<{
    filters?: Record<string, any>;
    sections?: string[];
    customFields?: Record<string, any>;
  }>(),
  data: jsonb('data').$type<{
    summary?: Record<string, any>;
    charts?: Record<string, any>[];
    tables?: Record<string, any>[];
  }>(),
  userId: integer('user_id').notNull(),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Analytics Data Table
export const analyticsData = pgTable('analytics_data', {
  id: integer('id').primaryKey().notNull(),
  metric: text('metric').notNull(),
  value: jsonb('value').notNull(),
  timestamp: timestamp('timestamp').default(sql`CURRENT_TIMESTAMP`).notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
});

// Create Zod schemas for type validation
export const insertReportSchema = createInsertSchema(reports).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true 
});

// Export types
export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type AnalyticsData = typeof analyticsData.$inferSelect;
