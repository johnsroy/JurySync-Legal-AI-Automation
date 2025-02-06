import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

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
    signatureStatus: z.object({
      required: z.array(z.string()),
      completed: z.array(z.string())
    }).optional()
  }).optional(),
  versionControl: z.object({
    version: z.string(),
    changes: z.array(z.object({
      timestamp: z.string(),
      user: z.string(),
      description: z.string()
    })),
    previousVersions: z.array(z.string())
  }).optional()
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