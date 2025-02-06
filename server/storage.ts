import { users, documents, User, Document } from "@shared/schema";
import type { InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getDocuments(userId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(document: Omit<Document, "id" | "createdAt">): Promise<Document>;
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
      console.log('Retrieved user:', user?.id);
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
      console.log('Retrieved user by username:', user?.id);
      return user;
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const [user] = await db.insert(users).values(insertUser).returning();
      console.log('Created user:', user.id);
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async getDocuments(userId: number): Promise<Document[]> {
    try {
      const docs = await db.select().from(documents).where(eq(documents.userId, userId));
      console.log(`Retrieved ${docs.length} documents for user:`, userId);
      console.log('Documents analysis:', docs.map(d => ({ id: d.id, analysis: d.analysis })));
      return docs.map(doc => ({
        ...doc,
        analysis: doc.analysis ? JSON.parse(JSON.stringify(doc.analysis)) : undefined
      }));
    } catch (error) {
      console.error('Error getting documents:', error);
      throw error;
    }
  }

  async getDocument(id: number): Promise<Document | undefined> {
    try {
      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, id));
      console.log('Retrieved document:', document?.id);
      console.log('Document analysis:', document?.analysis);
      if (document) {
        return {
          ...document,
          analysis: document.analysis ? JSON.parse(JSON.stringify(document.analysis)) : undefined
        };
      }
      return undefined;
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  }

  async createDocument(
    document: Omit<Document, "id" | "createdAt">,
  ): Promise<Document> {
    try {
      const documentToInsert = {
        ...document,
        analysis: document.analysis ? JSON.parse(JSON.stringify(document.analysis)) : undefined
      };
      const [newDocument] = await db
        .insert(documents)
        .values(documentToInsert)
        .returning();
      console.log('Created document:', newDocument.id);
      console.log('Document analysis:', newDocument.analysis);
      return {
        ...newDocument,
        analysis: newDocument.analysis ? JSON.parse(JSON.stringify(newDocument.analysis)) : undefined
      };
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();