import { pgTable, text, serial, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define user roles
export const UserRole = z.enum([
  "ADMIN",
  "USER",
  "VISITOR"
]);

export type UserRole = z.infer<typeof UserRole>;

// Update users table with role
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("USER"),
  email: text("email").notNull(),
});

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

// Define agent types
export const AgentType = z.enum([
  "CONTRACT_AUTOMATION",
  "COMPLIANCE_AUDITING",
  "LEGAL_RESEARCH",
  "NEW_AGENT_TYPE_1",
  "NEW_AGENT_TYPE_2"
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
  riskFactors: z.array(z.string()).optional(),
  redlineHistory: z.array(z.object({
    timestamp: z.string(),
    clause: z.string(),
    suggestion: z.string(),
    riskLevel: z.number(),
    accepted: z.boolean().optional()
  })).optional(),
  workflowState: z.object({
    status: ContractStatus,
    currentReviewer: z.string().optional(),
    comments: z.array(z.object({
      user: z.string(),
      text: z.string(),
      timestamp: z.string()
    })).optional(),
    signatureStatus: SignatureStatus, 
    approvalStatus: ApprovalStatus, 
    version: z.string() 
  }).optional(),
  versionControl: DocumentVersion.optional() 
});

// Update document analysis schema
export const documentAnalysisSchema = z.object({
  summary: z.string().min(1, "Summary is required"),
  keyPoints: z.array(z.string()).min(1, "At least one key point is required"),
  suggestions: z.array(z.string()).min(1, "At least one suggestion is required"),
  riskScore: z.number().min(1).max(10),
  contractDetails: contractDetailsSchema.optional(),
  complianceDetails: z.object({
    regulatoryFrameworks: z.array(z.string()).optional(),
    complianceStatus: z.string().optional(),
    violations: z.array(z.string()).optional(),
    requiredActions: z.array(z.string()).optional(),
    deadlines: z.array(z.string()).optional(),
    auditTrail: z.array(z.string()).optional(),
    riskAreas: z.array(z.string()).optional(),
    recommendedControls: z.array(z.string()).optional(),
  }).optional(),
  researchDetails: z.object({
    relevantCases: z.array(z.string()).optional(),
    precedents: z.array(z.string()).optional(),
    statutes: z.array(z.string()).optional(),
    legalPrinciples: z.array(z.string()).optional(),
    jurisdictions: z.array(z.string()).optional(),
    timelineSummary: z.string().optional(),
    argumentAnalysis: z.array(z.string()).optional(),
    citationNetwork: z.array(z.string()).optional(),
  }).optional(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  analysis: jsonb("analysis").notNull(),
  agentType: text("agent_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Export types
export type DocumentAnalysis = z.infer<typeof documentAnalysisSchema>;
export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;

// Enhanced validation for user registration
export const insertUserSchema = createInsertSchema(users)
  .pick({
    username: true,
    password: true,
    email: true,
    role: true
  })
  .extend({
    username: z.string()
      .min(3, "Username must be at least 3 characters long")
      .max(50, "Username cannot exceed 50 characters")
      .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens"),
    password: z.string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter"),
    email: z.string().email(),
    role: UserRole
  });

export const insertDocumentSchema = createInsertSchema(documents)
  .pick({
    title: true,
    agentType: true,
  })
  .extend({
    title: z.string().min(1, "Title is required"),
    agentType: AgentType,
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;


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