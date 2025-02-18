import {
  pgTable,
  serial,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

// Legal Documents Table
export const legalDocuments = pgTable("legal_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  documentType: text("document_type")
    .$type<z.infer<typeof DocumentType>>()
    .notNull(),
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

// Legal Research Reports
export const legalResearchReports = pgTable("legal_research_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  query: text("query").notNull(),
  searchType: text("search_type").notNull().default("NATURAL"), // NATURAL, BOOLEAN, PARALLEL
  jurisdiction: text("jurisdiction").notNull(),
  legalTopic: text("legal_topic").notNull(),
  results: jsonb("results").notNull(),
  dateRange: jsonb("date_range").$type<{
    start?: string;
    end?: string;
  }>(),
  savedFilters: jsonb("saved_filters"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Brief Analysis
export const briefAnalysis = pgTable("brief_analysis", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  analysis: jsonb("analysis").$type<{
    citations: string[];
    recommendations: string[];
    similarCases: string[];
    keyIssues: string[];
  }>(),
  citationHealth: jsonb("citation_health").$type<{
    status: Record<string, z.infer<typeof TreatmentStatus>>;
    warnings: string[];
    suggestions: string[];
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Citation Network
export const citationNetwork = pgTable("citation_network", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull(),
  targetId: integer("target_id").notNull(),
  treatment: text("treatment").$type<z.infer<typeof TreatmentStatus>>(),
  context: text("context"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Create insert schemas
export const insertLegalDocumentSchema = createInsertSchema(legalDocuments);
export const insertLegalResearchReportSchema =
  createInsertSchema(legalResearchReports);
export const insertBriefAnalysisSchema = createInsertSchema(briefAnalysis);
export const insertCitationNetworkSchema = createInsertSchema(citationNetwork);

// Export types
export type LegalDocument = typeof legalDocuments.$inferSelect;
export type InsertLegalDocument = z.infer<typeof insertLegalDocumentSchema>;
export type LegalResearchReport = typeof legalResearchReports.$inferSelect;
export type BriefAnalysis = typeof briefAnalysis.$inferSelect;
export type CitationNetwork = typeof citationNetwork.$inferSelect;
