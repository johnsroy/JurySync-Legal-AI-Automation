import { pgTable, text, serial, integer, jsonb, timestamp, boolean, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Document Types
export const DocumentType = z.enum([
  "CASE_LAW",
  "STATUTE",
  "REGULATION",
  "ADMINISTRATIVE",
  "SECONDARY_SOURCE",
  "BRIEF",
  "ARTICLE"
]);

// Citation Treatment
export const CitationTreatment = z.enum([
  "POSITIVE",
  "NEGATIVE",
  "DISTINGUISHED",
  "OVERRULED",
  "QUESTIONED",
  "CAUTIONED",
  "SUPERSEDED"
]);

// Legal Documents Table
export const legalDocuments = pgTable("legal_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  documentType: text("document_type").$type<z.infer<typeof DocumentType>>().notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  court: text("court"),
  docketNumber: text("docket_number"),
  dateDecided: timestamp("date_decided"),
  citation: text("citation"),
  holdingSummary: text("holding_summary"),
  blackLetterLaw: text("black_letter_law"),
  vectorEmbedding: jsonb("vector_embedding"),
  metadata: jsonb("metadata").$type<{
    parties?: string[];
    judges?: string[];
    attorneys?: string[];
    keywords?: string[];
    topics?: string[];
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Citation Network
export const citationNetwork = pgTable("citation_network", {
  id: serial("id").primaryKey(),
  citingDocumentId: integer("citing_document_id").notNull(),
  citedDocumentId: integer("cited_document_id").notNull(),
  treatment: text("treatment").$type<z.infer<typeof CitationTreatment>>(),
  context: text("context"),
  pinpoint: text("pinpoint"),
  createdAt: timestamp("created_at").defaultNow()
});

// Research Sessions
export const researchSessions = pgTable("research_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  query: text("query").notNull(),
  queryType: text("query_type").default("NATURAL"), // NATURAL, BOOLEAN, PARALLEL
  filters: jsonb("filters"),
  results: jsonb("results"),
  savedDocuments: jsonb("saved_documents"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Brief Analysis
export const briefAnalysis = pgTable("brief_analysis", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  documentId: integer("document_id").notNull(),
  citationAnalysis: jsonb("citation_analysis"),
  recommendations: jsonb("recommendations"),
  aiInsights: jsonb("ai_insights"),
  createdAt: timestamp("created_at").defaultNow()
});

// Create insert schemas
export const insertLegalDocumentSchema = createInsertSchema(legalDocuments);
export const insertCitationNetworkSchema = createInsertSchema(citationNetwork);
export const insertResearchSessionSchema = createInsertSchema(researchSessions);
export const insertBriefAnalysisSchema = createInsertSchema(briefAnalysis);

// Export types
export type LegalDocument = typeof legalDocuments.$inferSelect;
export type CitationNetwork = typeof citationNetwork.$inferSelect;
export type ResearchSession = typeof researchSessions.$inferSelect;
export type BriefAnalysis = typeof briefAnalysis.$inferSelect; 