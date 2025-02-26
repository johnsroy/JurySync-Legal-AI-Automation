import { pgTable, serial, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status").default("PENDING").notNull(),
  userId: integer("user_id").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  metadata: jsonb("metadata").default({}).notNull(),
  analysis: jsonb("analysis"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDocumentSchema = createInsertSchema(documents, {
  content: z.string().min(1, "Document content cannot be empty"),
  title: z.string().min(1, "Document title cannot be empty"),
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]).default("PENDING"),
  userId: z.number().int().positive(),
  fileType: z.string().optional(),
  fileSize: z.number().int().positive().optional(),
  metadata: z.record(z.any()).default({}),
  analysis: z.record(z.any()).optional(),
  errorMessage: z.string().optional(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>; 