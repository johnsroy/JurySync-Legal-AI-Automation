import { pgTable, text, serial, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, type InferModel } from 'drizzle-orm';

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

// Update the TemplateCategory enum with more specific categories
export const TemplateCategory = z.enum([
  "GENERAL",
  "EMPLOYMENT",
  "REAL_ESTATE",
  "BUSINESS",
  "INTELLECTUAL_PROPERTY",
  "SERVICE_AGREEMENT",
  "NDA",
  "LICENSING"
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

// Add after existing ComplianceStatus definition
export const MonitoringFrequency = z.enum([
  "REALTIME",
  "HOURLY",
  "DAILY",
  "WEEKLY",
  "MONTHLY"
]);

export type MonitoringFrequency = z.infer<typeof MonitoringFrequency>;

export const PredictionConfidence = z.enum([
  "HIGH",
  "MEDIUM",
  "LOW"
]);

export type PredictionConfidence = z.infer<typeof PredictionConfidence>;

// Add after existing document types
export const VaultDocumentType = z.enum([
  "CONTRACT",
  "BRIEF",
  "CASE_LAW",
  "LEGISLATION",
  "CORRESPONDENCE",
  "OTHER"
]);

export type VaultDocumentType = z.infer<typeof VaultDocumentType>;

// Update the legalDocuments table definition to ensure legalTopic is properly defined
export const legalDocuments = pgTable("legal_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  documentType: text("document_type").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  legalTopic: text("legal_topic").notNull(),
  date: timestamp("date").notNull(),
  status: text("status").notNull(),
  metadata: jsonb("metadata").$type<{
    court?: string;
    citation?: string;
    type?: string;
    publicLawNumber?: string;
  }>(),
  citations: jsonb("citations"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLegalDocumentSchema = createInsertSchema(legalDocuments);
export type LegalDocument = typeof legalDocuments.$inferSelect;
export type InsertLegalDocument = z.infer<typeof insertLegalDocumentSchema>;

// Add the relations
export const legalDocumentsRelations = relations(legalDocuments, ({ many }) => ({
  citations: many(legalDocuments)
}));

// Only updating the complianceDocuments table definition
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
  auditSummary: text("audit_summary"), // Added missing column
  automationMetrics: jsonb("automation_metrics").$type<{
    processingTimeMs: number;
    modelUsed: string;
    confidenceScore: number;
    laborSavings: number;
  }>(),
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

// Add after existing tables
export const complianceMonitoringSchedules = pgTable("compliance_monitoring_schedules", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  frequency: text("frequency").notNull(),
  lastChecked: timestamp("last_checked"),
  nextScheduled: timestamp("next_scheduled"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const compliancePredictions = pgTable("compliance_predictions", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  predictedStatus: text("predicted_status").notNull(),
  confidence: text("confidence").notNull(),
  riskFactors: jsonb("risk_factors").notNull(),
  suggestedActions: jsonb("suggested_actions").notNull(),
  deadline: timestamp("deadline"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const complianceAlerts = pgTable("compliance_alerts", {
  id: serial("id").primaryKey(),
  predictionId: integer("prediction_id").notNull(),
  documentId: integer("document_id").notNull(),
  severity: text("severity").notNull(),
  message: text("message").notNull(),
  status: text("status").default("PENDING"),
  createdAt: timestamp("created_at").defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: integer("acknowledged_by"),
});

// Create insert schemas for the new tables
export const insertRiskAssessmentSchema = createInsertSchema(riskAssessments);
export const insertComplianceIssueSchema = createInsertSchema(complianceIssues);
// Update insert schema
export const insertComplianceDocumentSchema = createInsertSchema(complianceDocuments);

// Export types
export type RiskAssessmentRecord = typeof riskAssessments.$inferSelect;
export type InsertRiskAssessment = z.infer<typeof insertRiskAssessmentSchema>;
export type ComplianceIssueRecord = typeof complianceIssues.$inferSelect;
export type InsertComplianceIssue = z.infer<typeof insertComplianceIssueSchema>;
export type ComplianceDocument = typeof complianceDocuments.$inferSelect;
export type InsertComplianceDocument = z.infer<typeof insertComplianceDocumentSchema>;

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

// Add new schemas for the tables
export const insertMonitoringScheduleSchema = createInsertSchema(complianceMonitoringSchedules)
  .extend({
    frequency: MonitoringFrequency,
  });

export const insertPredictionSchema = createInsertSchema(compliancePredictions)
  .extend({
    confidence: PredictionConfidence,
    riskFactors: z.array(z.object({
      factor: z.string(),
      impact: z.number().min(0).max(100),
      description: z.string()
    })),
    suggestedActions: z.array(z.object({
      action: z.string(),
      priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
      deadline: z.string().optional()
    }))
  });

export const insertAlertSchema = createInsertSchema(complianceAlerts);

// Export types
export type ComplianceMonitoringSchedule = typeof complianceMonitoringSchedules.$inferSelect;
export type InsertMonitoringSchedule = z.infer<typeof insertMonitoringScheduleSchema>;
export type CompliancePrediction = typeof compliancePredictions.$inferSelect;
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type ComplianceAlert = typeof complianceAlerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

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

// Move ClauseRiskLevel definition up
export const ClauseRiskLevel = z.enum([
  "HIGH",
  "MEDIUM",
  "LOW"
]);

export type ClauseRiskLevel = z.infer<typeof ClauseRiskLevel>;

// Move ClauseAnalysis definition before documentAnalysisSchema
export const ClauseAnalysis = z.object({
  id: z.string(),
  originalText: z.string(),
  startIndex: z.number(),
  endIndex: z.number(),
  riskLevel: ClauseRiskLevel,
  riskScore: z.number().min(0).max(1),
  suggestedText: z.string(),
  explanation: z.string(),
  category: z.enum(["LEGAL", "COMPLIANCE", "COMMERCIAL", "TECHNICAL"]),
  impact: z.string(),
  confidence: z.number().min(0).max(1)
});

export type ClauseAnalysis = z.infer<typeof ClauseAnalysis>;

// Now define documentAnalysisSchema using the already defined ClauseAnalysis
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
  }).optional(),
  clauseAnalysis: z.array(ClauseAnalysis).optional(),
});

export type DocumentAnalysis = z.infer<typeof documentAnalysisSchema>;

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


// Update complianceAudits table to include updated_at
export const complianceAudits = pgTable('compliance_audits', {
  id: serial("id").primaryKey(),
  documentText: text("document_text").notNull(),
  openaiResponse: jsonb("openai_response").notNull(),
  anthropicResponse: jsonb("anthropic_response").notNull(),
  combinedReport: jsonb("combined_report").notNull(),
  vectorId: text("vector_id"), // Reference to ChromaDB embedding
  metadata: jsonb("metadata").$type<{
    documentType?: string;
    priority?: string;
    tags?: string[];
    confidence?: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Add after existing schemas
export const insertComplianceAuditSchema = createInsertSchema(complianceAudits);

// Add after existing types
export type ComplianceAudit = typeof complianceAudits.$inferSelect;
export type InsertComplianceAudit = z.infer<typeof insertComplianceAuditSchema>;

// Add after the existing tables
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

// Update the contractTemplates table with additional metadata fields
export const contractTemplates = pgTable("contract_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<{
    variables: Array<{
      name: string;
      description: string;
      required: boolean;
      type: string;
      defaultValue?: string;
      validationRules?: string[];
    }>;
    tags: string[];
    useCase: string;
    complexity: "LOW" | "MEDIUM" | "HIGH";
    recommendedClauses: string[];
    industrySpecific: boolean;
    lastUpdated: string;
    version: string;
    aiAssistanceLevel: "BASIC" | "ADVANCED" | "EXPERT";
  }>(),
  subcategory: text("subcategory"),
  industry: text("industry").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  complexity: text("complexity").default("MEDIUM"),
  estimatedCompletionTime: text("estimated_completion_time"),
  popularityScore: integer("popularity_score").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertContractTemplateSchema = createInsertSchema(contractTemplates);
export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type InsertContractTemplate = z.infer<typeof insertContractTemplateSchema>;

// Add new schema for template categories organization
export const templateCategories = pgTable("template_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  displayOrder: integer("display_order").notNull(),
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Add relations
export const templateCategoriesRelations = relations(templateCategories, ({ one, many }) => ({
  parent: one(templateCategories, {
    fields: [templateCategories.parentId],
    references: [templateCategories.id],
  }),
  children: many(templateCategories),
  templates: many(contractTemplates),
}));

export const contractTemplatesRelations = relations(contractTemplates, ({ one }) => ({
  category: one(templateCategories, {
    fields: [contractTemplates.category],
    references: [templateCategories.name],
  }),
}));

// Add this after the legal research types
// Analytics data schema for metrics collection (This section is removed because it's duplicated)


// Add after existing schemas
export const RegulatoryUpdateType = z.enum([
  "LEGISLATION",
  "REGULATION",
  "GUIDANCE",
  "POLICY",
  "ADVISORY"
]);

export const CaseLawCategory = z.enum([
  "CONSTITUTIONAL",
  "CRIMINAL",
  "CIVIL",
  "ADMINISTRATIVE",
  "COMMERCIAL",
  "ENVIRONMENTAL",
  "LABOR",
  "INTELLECTUAL_PROPERTY"
]);

// Table for storing regulatory updates
export const regulatoryUpdates = pgTable("regulatory_updates", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  effectiveDate: timestamp("effective_date"),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  vectorId: text("vector_id"), // Reference to ChromaDB embedding
  metadata: jsonb("metadata").$type<{
    industry?: string[];
    impactLevel?: "HIGH" | "MEDIUM" | "LOW";
    sectors?: string[];
    tags?: string[];
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Table for case law updates
export const caseLawUpdates = pgTable("case_law_updates", {
  id: serial("id").primaryKey(),
  caseNumber: text("case_number").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  full_text: text("full_text").notNull(),
  court: text("court").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  category: text("category").notNull(),
  decisionDate: timestamp("decision_date").notNull(),
  vectorId: text("vector_id"),
  metadata: jsonb("metadata").$type<{
    precedentValue?: "HIGH" | "MEDIUM" | "LOW";
    overruledCases?: string[];
    citedCases?: string[];
    keywords?: string[];
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Table for tracking continuous learning updates
export const continuousLearningUpdates = pgTable("continuous_learning_updates", {
  id: serial("id").primaryKey(),
  updateType: text("update_type").notNull(), // 'REGULATORY' or 'CASE_LAW'
  updateId: integer("update_id").notNull(),
  processingStatus: text("processing_status").notNull(),
  vectorEmbeddingId: text("vector_embedding_id"),
  contextParameters: jsonb("context_parameters").notNull(),
  modelImpact: jsonb("model_impact").$type<{
    affectedModels: string[];
    parameterUpdates: Record<string, any>;
    confidenceScores: Record<string, number>;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  nextUpdateDue: timestamp("next_update_due"),
});

// Create insert schemas
export const insertRegulatoryUpdateSchema = createInsertSchema(regulatoryUpdates);
export const insertCaseLawUpdateSchema = createInsertSchema(caseLawUpdates);
export const insertContinuousLearningUpdateSchema = createInsertSchema(continuousLearningUpdates);

// Export types
export type RegulatoryUpdate = typeof regulatoryUpdates.$inferSelect;
export type CaseLawUpdate = typeof caseLawUpdates.$inferSelect;
export type ContinuousLearningUpdate = typeof continuousLearningUpdates.$inferSelect;

export type InsertRegulatoryUpdate = z.infer<typeof insertRegulatoryUpdateSchema>;
export type InsertCaseLawUpdate = z.infer<typeof insertCaseLawUpdateSchema>;
export type InsertContinuousLearningUpdate = z.infer<typeof insertContinuousLearningUpdateSchema>;

// Add this after CaseLawUpdate type declaration
export interface CaseLawUpdateWithFullText extends CaseLawUpdate {
  full_text: string;
}

// Add metrics events table to track AI and automation usage
export const metricsEvents = pgTable("metrics_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  modelId: text("model_id").notNull(),
  taskType: text("task_type").notNull(),
  processingTimeMs: integer("processing_time_ms").notNull(),
  successful: boolean("successful").notNull(),
  costSavingEstimate: integer("cost_saving_estimate"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export type MetricsEvent = typeof metricsEvents.$inferSelect;
export type InsertMetricsEvent = typeof metricsEvents.$inferInsert;

export const insertMetricsEventSchema = createInsertSchema(metricsEvents);

// Add after existing document schema
export const documentAnalysis = pgTable("document_analysis", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  documentType: text("document_type").notNull(),
  industry: text("industry").notNull(),
  complianceStatus: jsonb("compliance_status").notNull().$type<{
    status: 'PASSED' | 'FAILED' | 'PENDING';
    details: string;
    lastChecked: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export type DocumentAnalysisRecord = typeof documentAnalysis.$inferSelect;
export type InsertDocumentAnalysis = typeof documentAnalysis.$inferInsert;

// Add relations
export const documentAnalysisRelations = relations(documentAnalysis, ({ one }) => ({
  document: one(documents, {
    fields: [documentAnalysis.documentId],
    references: [documents.id],
  }),
}));

// Remove duplicate table definitions and ensure only one instance of vaultDocumentAnalysis exists
export const vaultDocumentAnalysis = pgTable("vault_documentanalysis", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  fileName: text("file_name").notNull(),
  fileDate: text("file_date").notNull(),
  documentType: text("document_type").notNull().default("Audit"),
  industry: text("industry").notNull().default("Technology"),
  complianceStatus: text("compliance_status").notNull().default("Compliant"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Add relations
export const vaultDocumentAnalysisRelations = relations(vaultDocumentAnalysis, ({ one }) => ({
  document: one(vaultDocuments, {
    fields: [vaultDocumentAnalysis.documentId],
    references: [vaultDocuments.id],
  }),
}));

export type VaultDocumentAnalysis = typeof vaultDocumentAnalysis.$inferSelect;
export const insertVaultDocumentAnalysisSchema = createInsertSchema(vaultDocumentAnalysis);
export type InsertVaultDocumentAnalysis = z.infer<typeof insertVaultDocumentAnalysisSchema>;

// Add this to your existing schema file
export const legalResearchReports = pgTable('legal_research_reports', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  query: text('query').notNull(),
  jurisdiction: text('jurisdiction').notNull().default('All'),
  legalTopic: text('legal_topic').notNull().default('All'),
  results: jsonb('results').notNull(),
  dateRange: jsonb('date_range').$type<{
    start?: string;
    end?: string;
  }>(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

export const legalAnalyses = pgTable('legal_analyses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  documentContent: text('document_content').notNull(),
  analysis: jsonb('analysis').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

export const vaultDocuments = pgTable("vault_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  documentType: text("document_type").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  aiSummary: text("ai_summary"),
  aiClassification: text("ai_classification"),
  vectorId: text("vector_id"),
  metadata: jsonb("metadata").$type<{
    keywords?: string[];
    relevance?: number;
    confidence?: number;
    entities?: string[];
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVaultDocumentSchema = createInsertSchema(vaultDocuments)
  .pick({
    title: true,
    content: true,
    documentType: true,
    fileSize: true,
    mimeType: true,
  })
  .extend({
    title: z.string().min(1, "Title is required"),
    documentType: VaultDocumentType,
  });

export type VaultDocument = typeof vaultDocuments.$inferSelect;
export type InsertVaultDocument = z.infer<typeof insertVaultDocumentSchema>;