import { 
  users, documents, approvals, signatures, documentVersions,
  User, Document, Approval, Signature, DocumentVersion
} from "@shared/schema";
import type { InsertUser, InsertApproval, InsertSignature, InsertDocumentVersion } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Existing methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getDocuments(userId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(document: Omit<Document, "id" | "createdAt">): Promise<Document>;
  updateDocument(id: number, document: Partial<Omit<Document, "id" | "createdAt">>): Promise<Document>;
  deleteDocument(id: number): Promise<void>;

  // New methods for approvals
  createApproval(approval: Omit<InsertApproval, "id" | "createdAt">): Promise<Approval>;
  getApproval(id: number): Promise<Approval | undefined>;
  updateApproval(id: number, status: string, comments?: string): Promise<Approval>;

  // Methods for signatures
  createSignature(signature: Omit<InsertSignature, "id" | "createdAt">): Promise<Signature>;
  getSignature(id: number): Promise<Signature | undefined>;
  updateSignature(id: number, status: string, signatureData?: any): Promise<Signature>;

  // Methods for versions
  createVersion(version: Omit<InsertDocumentVersion, "id" | "createdAt">): Promise<DocumentVersion>;
  getVersions(documentId: number): Promise<DocumentVersion[]>;
  getLatestVersion(documentId: number): Promise<DocumentVersion | undefined>;

  // Get users by role
  getUsersByRole(role: string): Promise<User[]>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username));
      return user;
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const [user] = await db.insert(users).values(insertUser).returning();
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async getDocuments(userId: number): Promise<Document[]> {
    try {
      const docs = await db.select().from(documents).where(eq(documents.userId, userId));
      return docs.map(doc => ({
        ...doc,
        analysis: typeof doc.analysis === 'string' ? JSON.parse(doc.analysis) : doc.analysis
      }));
    } catch (error) {
      console.error('Error getting documents:', error);
      throw error;
    }
  }

  async getDocument(id: number): Promise<Document | undefined> {
    try {
      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, id));

      if (!doc) return undefined;

      return {
        ...doc,
        analysis: typeof doc.analysis === 'string' ? JSON.parse(doc.analysis) : doc.analysis
      };
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  }

  async createDocument(
    document: Omit<Document, "id" | "createdAt">,
  ): Promise<Document> {
    try {
      const [newDoc] = await db
        .insert(documents)
        .values({
          ...document,
          analysis: typeof document.analysis === 'string' ? 
            document.analysis : 
            JSON.stringify(document.analysis)
        })
        .returning();

      return {
        ...newDoc,
        analysis: typeof newDoc.analysis === 'string' ? 
          JSON.parse(newDoc.analysis) : 
          newDoc.analysis
      };
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }

  async updateDocument(
    id: number,
    document: Partial<Omit<Document, "id" | "createdAt">>
  ): Promise<Document> {
    try {
      const [updatedDoc] = await db
        .update(documents)
        .set({
          ...document,
          analysis: typeof document.analysis === 'string' ? 
            document.analysis : 
            JSON.stringify(document.analysis)
        })
        .where(eq(documents.id, id))
        .returning();

      return {
        ...updatedDoc,
        analysis: typeof updatedDoc.analysis === 'string' ? 
          JSON.parse(updatedDoc.analysis) : 
          updatedDoc.analysis
      };
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  }

  async deleteDocument(id: number): Promise<void> {
    try {
      await db.delete(documents).where(eq(documents.id, id));
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  async createApproval(approval: Omit<InsertApproval, "id" | "createdAt">): Promise<Approval> {
    const [newApproval] = await db.insert(approvals).values(approval).returning();
    return newApproval;
  }

  async getApproval(id: number): Promise<Approval | undefined> {
    const [approval] = await db.select().from(approvals).where(eq(approvals.id, id));
    return approval;
  }

  async updateApproval(id: number, status: string, comments?: string): Promise<Approval> {
    const [updated] = await db
      .update(approvals)
      .set({ status, comments, updatedAt: new Date() })
      .where(eq(approvals.id, id))
      .returning();
    return updated;
  }

  async createSignature(signature: Omit<InsertSignature, "id" | "createdAt">): Promise<Signature> {
    const [newSignature] = await db.insert(signatures).values(signature).returning();
    return newSignature;
  }

  async getSignature(id: number): Promise<Signature | undefined> {
    const [signature] = await db.select().from(signatures).where(eq(signatures.id, id));
    return signature;
  }

  async updateSignature(id: number, status: string, signatureData?: any): Promise<Signature> {
    const [updated] = await db
      .update(signatures)
      .set({ status, signatureData, signedAt: status === 'COMPLETED' ? new Date() : null })
      .where(eq(signatures.id, id))
      .returning();
    return updated;
  }

  async createVersion(version: Omit<InsertDocumentVersion, "id" | "createdAt">): Promise<DocumentVersion> {
    const [newVersion] = await db.insert(documentVersions).values(version).returning();
    return newVersion;
  }

  async getVersions(documentId: number): Promise<DocumentVersion[]> {
    return db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(documentVersions.createdAt);
  }

  async getLatestVersion(documentId: number): Promise<DocumentVersion | undefined> {
    const [latest] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(documentVersions.createdAt, "desc")
      .limit(1);
    return latest;
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, role));
  }
}

export const storage = new DatabaseStorage();