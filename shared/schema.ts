import { pgTable, text, serial, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define user roles for LegalAI
export const UserRole = z.enum([
  "ADMIN",
  "LAWYER",
  "PARALEGAL",
  "CLIENT"
]);

export type UserRole = z.infer<typeof UserRole>;

// Users table with essential fields and subscription tracking
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("CLIENT"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImage: text("profile_image"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Subscription and trial tracking
  subscriptionStatus: text("subscription_status").default("TRIAL"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  trialUsed: boolean("trial_used").default(false),
  lastUploadDate: timestamp("last_upload_date"),
  uploadCount: integer("upload_count").default(0),
  stripeCustomerId: text("stripe_customer_id"),
  stripePriceId: text("stripe_price_id"),
});

// Validation schema for user registration
export const insertUserSchema = createInsertSchema(users)
  .pick({
    username: true,
    email: true,
    password: true,
    firstName: true,
    lastName: true,
    role: true
  })
  .extend({
    username: z.string()
      .min(3, "Username must be at least 3 characters")
      .max(50, "Username cannot exceed 50 characters")
      .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens"),
    email: z.string()
      .email("Please enter a valid email address"),
    password: z.string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    role: UserRole.optional().default("CLIENT"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
  });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Define agent types for LegalAI
export const AgentType = z.enum([
  "CONTRACT_AUTOMATION",
  "COMPLIANCE_AUDITING",
  "LEGAL_RESEARCH"
]);

export type AgentType = z.infer<typeof AgentType>;

// Define contract workflow states
export const ContractStatus = z.enum([
  "DRAFT",
  "REVIEW",
  "REDLINE",
  "APPROVAL",
  "SIGNATURE",
  "COMPLETED"
]);

export type ContractStatus = z.infer<typeof ContractStatus>;

// Add an enum for template categories
export const TemplateCategory = z.enum([
  "EMPLOYMENT",
  "NDA",
  "SERVICE_AGREEMENT",
  "LEASE",
  "GENERAL",
  "SALES",
  "PARTNERSHIP",
  "CONSULTING",
  "IP_LICENSE",
  "REAL_ESTATE"
]);

export type TemplateCategory = z.infer<typeof TemplateCategory>;


// Define compliance document status
export const ComplianceStatus = z.enum([
  "PENDING",
  "MONITORING",
  "ERROR",
  "FLAGGED"
]);

export type ComplianceStatus = z.infer<typeof ComplianceStatus>;

// Update RiskSeverity enum to include more specific categories
export const RiskSeverity = z.enum([
  "CRITICAL",    // Immediate attention required
  "HIGH",        // Significant risk
  "MEDIUM",      // Moderate risk
  "LOW",         // Minor risk
  "INFO"         // Informational finding
]);

export type RiskSeverity = z.infer<typeof RiskSeverity>;

// Add these new types after the RiskSeverity definition
export const RiskTrendIndicator = z.enum([
  "INCREASING",
  "STABLE",
  "DECREASING"
]);

export type RiskTrendIndicator = z.infer<typeof RiskTrendIndicator>;

export const RiskFactors = z.object({
  regulatory: z.number().min(0).max(100),
  contractual: z.number().min(0).max(100),
  litigation: z.number().min(0).max(100),
  operational: z.number().min(0).max(100)
});

// Update the RiskAssessmentSchema
export const RiskAssessmentSchema = z.object({
  score: z.number().min(0).max(100),
  severity: RiskSeverity,
  category: z.string(),
  description: z.string(),
  impact: z.string(),
  mitigation: z.string(),
  references: z.array(z.string()).optional(),
  context: z.string().optional(),
  confidence: z.number().min(0).max(100),
  detectedAt: z.string(),
  riskFactors: RiskFactors.optional(),
  trendIndicator: RiskTrendIndicator.optional(),
  timeToMitigate: z.string().optional(),
  potentialCost: z.string().optional()
});

export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

// Risk Assessment Results table
export const riskAssessments = pgTable("risk_assessments", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  score: integer("score").notNull(),
  severity: text("severity").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  impact: text("impact").notNull(),
  mitigation: text("mitigation").notNull(),
  references: jsonb("ref_links").default([]),
  context: text("context"),
  confidence: integer("confidence").notNull(),
  detectedAt: timestamp("detected_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  riskFactors: jsonb("risk_factors").$type<z.infer<typeof RiskFactors>>(),
  trendIndicator: text("trend_indicator"),
  timeToMitigate: text("time_to_mitigate"),
  potentialCost: text("potential_cost")
});

// Schema for compliance documents
export const complianceDocuments = pgTable("compliance_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  documentType: text("document_type").notNull(),
  status: text("status").notNull().default("PENDING"),
  riskScore: integer("risk_score"),
  lastScanned: timestamp("last_scanned"),
  nextScanDue: timestamp("next_scan_due"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Compliance Issues table (updated)
export const complianceIssues = pgTable("compliance_issues", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  riskAssessmentId: integer("risk_assessment_id").notNull(),
  clause: text("clause").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(),
  recommendation: text("recommendation").notNull(),
  reference: text("reference"),
  status: text("status").notNull().default("OPEN"),
  assignedTo: text("assigned_to"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Create insert schemas for the new tables
export const insertRiskAssessmentSchema = createInsertSchema(riskAssessments);
export const insertComplianceIssueSchema = createInsertSchema(complianceIssues);

// Export types
export type RiskAssessmentRecord = typeof riskAssessments.$inferSelect;
export type InsertRiskAssessment = z.infer<typeof insertRiskAssessmentSchema>;
export type ComplianceIssueRecord = typeof complianceIssues.$inferSelect;
export type InsertComplianceIssue = z.infer<typeof insertComplianceIssueSchema>;

// Schema for compliance monitoring results
export const ComplianceIssue = z.object({
  id: z.string(),
  documentId: z.string(),
  clause: z.string(),
  description: z.string(),
  severity: RiskSeverity,
  recommendation: z.string(),
  reference: z.string().optional(),
  detectedAt: z.string(),
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED"]),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional()
});

export type ComplianceIssue = z.infer<typeof ComplianceIssue>;

// Schema for monitoring configuration
export const MonitoringConfig = z.object({
  documentId: z.string(),
  frequency: z.enum(["REALTIME", "HOURLY", "DAILY", "WEEKLY"]),
  alertThreshold: RiskSeverity,
  notifyUsers: z.array(z.string()),
  enabledChecks: z.array(z.string()),
  lastChecked: z.string().optional(),
  nextCheck: z.string().optional()
});

export type MonitoringConfig = z.infer<typeof MonitoringConfig>;

// Extended contract details schema
export const contractDetailsSchema = z.object({
  parties: z.array(z.string()).optional(),
  effectiveDate: z.string().optional(),
  termLength: z.string().optional(),
  keyObligations: z.array(z.string()).optional(),
  terminationClauses: z.array(z.string()).optional(),
  governingLaw: z.string().optional(),
  paymentTerms: z.string().optional(),
  disputeResolution: z.string().optional(),
  missingClauses: z.array(z.string()).optional(),
  suggestedClauses: z.array(z.string()).optional(),
  riskFactors: z.array(z.string()).optional()
});

// Document analysis schema with agent-specific fields
export const documentAnalysisSchema = z.object({
  summary: z.string().min(1, "Summary is required"),
  keyPoints: z.array(z.string()).min(1, "At least one key point is required"),
  suggestions: z.array(z.string()).min(1, "At least one suggestion is required"),
  riskScore: z.number().min(1).max(10),
  contractDetails: contractDetailsSchema.optional(),
  complianceDetails: z.object({
    regulatoryFrameworks: z.array(z.string()),
    complianceStatus: z.string(),
    violations: z.array(z.string()),
    requiredActions: z.array(z.string()),
    deadlines: z.array(z.string()),
    auditTrail: z.array(z.string()),
    riskAreas: z.array(z.string()),
    recommendedControls: z.array(z.string())
  }).optional(),
  researchDetails: z.object({
    relevantCases: z.array(z.string()),
    precedents: z.array(z.string()),
    statutes: z.array(z.string()),
    legalPrinciples: z.array(z.string()),
    jurisdictions: z.array(z.string()),
    timelineSummary: z.string(),
    argumentAnalysis: z.array(z.string()),
    citationNetwork: z.array(z.string())
  }).optional()
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  analysis: jsonb("analysis").notNull(),
  agentType: text("agent_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  processingStatus: text("processing_status").default("PENDING"),
  errorMessage: text("error_message"),
});

// Export types
export type DocumentAnalysis = z.infer<typeof documentAnalysisSchema>;
export type Document = typeof documents.$inferSelect;

export const insertDocumentSchema = createInsertSchema(documents)
  .pick({
    title: true,
    agentType: true,
  })
  .extend({
    title: z.string().min(1, "Title is required"),
    agentType: AgentType,
  });

export type InsertDocument = z.infer<typeof insertDocumentSchema>;

// Document version control schema
export const DocumentVersionSchema = z.object({
  version: z.string(),
  content: z.string(),
  timestamp: z.string(),
  author: z.object({
    id: z.number(),
    username: z.string(),
  }),
  changes: z.array(z.object({
    type: z.enum(["ADDITION", "DELETION", "MODIFICATION"]),
    content: z.string(),
    lineNumber: z.number().optional(),
  })),
});

export type DocumentVersionType = z.infer<typeof DocumentVersionSchema>;

// Document versions table definition
export const documentVersions = pgTable("document_versions", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  version: text("version").notNull(),
  content: text("content").notNull(),
  changes: jsonb("changes").notNull(),
  authorId: integer("author_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type DocumentVersion = typeof documentVersions.$inferSelect;
export type InsertDocumentVersion = typeof documentVersions.$inferInsert;

// Define approval status
export const ApprovalStatus = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED"
]);

export type ApprovalStatus = z.infer<typeof ApprovalStatus>;

// Define signature status
export const SignatureStatus = z.enum([
  "PENDING",
  "COMPLETED",
  "EXPIRED"
]);

export type SignatureStatus = z.infer<typeof SignatureStatus>;

// Add these types after the existing imports
export const ComplianceFileStatus = z.enum([
  "UPLOADING",
  "UPLOADED",
  "PROCESSING",
  "PROCESSED",
  "ERROR"
]);

export type ComplianceFileStatus = z.infer<typeof ComplianceFileStatus>;

// Add this table definition before the complianceDocuments table
export const complianceFiles = pgTable("compliance_files", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  filename: text("filename").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  status: text("status").notNull().default("UPLOADING"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  processingStartedAt: timestamp("processing_started_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  errorMessage: text("error_message"),
});

export type ComplianceFile = typeof complianceFiles.$inferSelect;
export const insertComplianceFileSchema = createInsertSchema(complianceFiles);
export type InsertComplianceFile = z.infer<typeof insertComplianceFileSchema>;


// Additional tables after the existing ones...

export const approvals = pgTable("approvals", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  requesterId: integer("requester_id").notNull(),
  approverId: integer("approver_id").notNull(),
  status: text("status").notNull(),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const signatures = pgTable("signatures", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  userId: integer("user_id").notNull(),
  status: text("status").notNull(),
  signatureData: jsonb("signature_data"),
  signedAt: timestamp("signed_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Add types for the new tables
export type Approval = typeof approvals.$inferSelect;
export type Signature = typeof signatures.$inferSelect;

// Create insert schemas for the new tables
export const insertApprovalSchema = createInsertSchema(approvals);
export const insertSignatureSchema = createInsertSchema(signatures);

export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type InsertSignature = z.infer<typeof insertSignatureSchema>;

// Add new schema for contract templates
export const contractTemplates = pgTable("contract_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").notNull(),
  industry: text("industry"),
  jurisdiction: text("jurisdiction"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const templateMetadataSchema = z.object({
  description: z.string(),
  tags: z.array(z.string()),
  useCase: z.string(),
  complexity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  recommendedClauses: z.array(z.string()),
  variables: z.array(z.object({
    name: z.string(),
    type: z.enum(["TEXT", "DATE", "NUMBER", "BOOLEAN"]),
    description: z.string(),
    required: z.boolean(),
  })),
});

export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type InsertContractTemplate = typeof contractTemplates.$inferInsert;

// Add schema for template cache
export const templateCache = pgTable("template_cache", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  templateId: integer("template_id").notNull(),
  generatedContent: text("generated_content").notNull(),
  requirements: jsonb("requirements").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export type TemplateCache = typeof templateCache.$inferSelect;
export type InsertTemplateCache = typeof templateCache.$inferInsert;

// Legal document types
export const legalDocuments = pgTable("legal_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  documentType: text("document_type").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  date: timestamp("date").notNull(),
  citations: jsonb("citations").$type<string[]>(),
  vectorId: text("vector_id"), // Reference to ChromaDB embedding
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  status: text("status").default("ACTIVE"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Citations and relationships
export const legalCitations = pgTable("legal_citations", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  citedCase: text("cited_case").notNull(),
  context: text("context"),
  relevance: text("relevance"),
  createdAt: timestamp("created_at").defaultNow()
});

// Research queries and results
export const researchQueries = pgTable("research_queries", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  results: jsonb("results").$type<{
    summary: string;
    relevantCases: Array<{
      id: number;
      title: string;
      similarity: number;
    }>;
    timeline?: Array<{
      date: string;
      event: string;
      significance: string;
    }>;
    citationMap?: Array<{
      id: string;
      title: string;
      citations: string[];
    }>;
  }>(),
  createdAt: timestamp("created_at").defaultNow()
});

// Export types
export type LegalDocument = typeof legalDocuments.$inferSelect;
export type Citation = typeof legalCitations.$inferSelect;
export type ResearchQuery = typeof researchQueries.$inferSelect;

// Create insert schemas
export const insertLegalDocumentSchema = createInsertSchema(legalDocuments);
export const insertCitationSchema = createInsertSchema(legalCitations);
export const insertResearchQuerySchema = createInsertSchema(researchQueries);

export type InsertLegalDocument = typeof legalDocuments.$inferInsert;
export type InsertCitation = typeof legalCitations.$inferInsert;
export type InsertResearchQuery = typeof researchQueries.$inferInsert;