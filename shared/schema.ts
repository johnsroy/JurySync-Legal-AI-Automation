import {
  pgTable,
  serial,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  varchar,
  pgEnum
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Legal Document Types
export const DocumentType = z.enum([
  "CASE_LAW",
  "STATUTE",
  "REGULATION",
  "GUIDANCE",
  "ARTICLE",
  "BRIEF",
]);

// Treatment Status
export const TreatmentStatus = z.enum([
  "POSITIVE",
  "NEGATIVE",
  "NEUTRAL",
  "OVERRULED",
  "DISTINGUISHED",
]);

// Compliance Status
export const ComplianceStatus = z.enum([
  "COMPLIANT",
  "NON_COMPLIANT",
  "PENDING_REVIEW",
  "REQUIRES_ACTION",
  "EXEMPT"
]);

// User Role Enum
export const userRoleEnum = pgEnum('user_role', [
  'ADMIN',
  'LAWYER',
  'PARALEGAL',
  'CLIENT'
]);

// Agent Type Enum
export const agentTypeEnum = pgEnum('agent_type', [
  'RESEARCH',
  'ANALYSIS',
  'COMPLIANCE',
  'DRAFTING'
]);

// Risk Status Enum
export const riskStatusEnum = pgEnum('risk_status', [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'NEEDS_REVIEW',
  'REJECTED'
]);

// Base Tables
export const users = pgTable("users", {
  id: integer("id").primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default('CLIENT'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  documentType: text("document_type").$type<z.infer<typeof DocumentType>>().notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  dateCreated: timestamp("date_created").defaultNow(),
  lastModified: timestamp("last_modified").defaultNow(),
  status: text("status").notNull(),
  metadata: jsonb("metadata"),
  vectorEmbedding: text("vector_embedding"),
});

export const legalDocuments = pgTable("legal_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  documentType: text("document_type").$type<z.infer<typeof DocumentType>>().notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  legalTopic: text("legal_topic").notNull(),
  date: timestamp("date").notNull(),
  status: text("status").notNull(),
  summary: text("summary"),
  holdingSummary: text("holding_summary"),
  blackLetterLaw: text("black_letter_law"),
  vectorEmbedding: text("vector_embedding"),
  metadata: jsonb("metadata").$type<{
    court?: string;
    citation?: string;
    type?: string;
    publicLawNumber?: string;
    keyPrinciples?: string[];
    proceduralHistory?: string;
    outcome?: string;
  }>(),
  citations: jsonb("citations").$type<{
    citing: string[];
    citedBy: string[];
    treatment: Record<string, z.infer<typeof TreatmentStatus>>;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const riskAssessments = pgTable("risk_assessments", {
  id: integer("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  userId: integer("user_id").notNull(),
  status: riskStatusEnum("status").notNull().default('PENDING'),
  riskScore: integer("risk_score"),
  findings: jsonb("findings").$type<{
    highRisks: string[];
    mediumRisks: string[];
    lowRisks: string[];
    recommendations: string[];
  }>(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Re-export other schema modules
export * from "./schema/reports";
export * from "./schema/metrics";

// Create Zod schemas
export const insertUserSchema = createInsertSchema(users, {
  role: z.enum(['ADMIN', 'LAWYER', 'PARALEGAL', 'CLIENT']).default('CLIENT'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const insertDocumentSchema = createInsertSchema(documents);
export const insertLegalDocumentSchema = createInsertSchema(legalDocuments);
export const insertRiskAssessmentSchema = createInsertSchema(riskAssessments, {
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'NEEDS_REVIEW', 'REJECTED']).default('PENDING'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type LegalDocument = typeof legalDocuments.$inferSelect;
export type InsertLegalDocument = z.infer<typeof insertLegalDocumentSchema>;
export type RiskAssessment = typeof riskAssessments.$inferSelect;
export type InsertRiskAssessment = z.infer<typeof insertRiskAssessmentSchema>;
export type UserRole = z.infer<typeof userRoleEnum>;
export type AgentType = z.infer<typeof agentTypeEnum>;