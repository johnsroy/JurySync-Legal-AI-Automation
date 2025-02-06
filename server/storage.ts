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
}

export const storage = new DatabaseStorage();