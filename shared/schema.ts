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

// Define version control types
export const DocumentVersion = z.object({
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

export type DocumentVersion = z.infer<typeof DocumentVersion>;

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

export const documentVersions = pgTable("document_versions", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  version: text("version").notNull(),
  content: text("content").notNull(),
  changes: jsonb("changes").notNull(),
  authorId: integer("author_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Add types for the new tables
export type Approval = typeof approvals.$inferSelect;
export type Signature = typeof signatures.$inferSelect;
export type DocumentVersion = typeof documentVersions.$inferSelect;

// Create insert schemas for the new tables
export const insertApprovalSchema = createInsertSchema(approvals);
export const insertSignatureSchema = createInsertSchema(signatures);
export const insertDocumentVersionSchema = createInsertSchema(documentVersions);

export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type InsertSignature = z.infer<typeof insertSignatureSchema>;
export type InsertDocumentVersion = z.infer<typeof insertDocumentVersionSchema>;