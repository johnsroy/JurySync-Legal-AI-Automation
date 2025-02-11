import { users, type User } from "@shared/schema";
import { type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

interface DocumentMetadata {
  id: string;
  userId?: number;
  filename: string;
  fileType: string;
  pageCount?: number;
  wordCount: number;
  status: 'parsed' | 'error';
  createdAt: Date;
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User>;
  sessionStore: session.Store;

  // Document operations
  saveDocument(document: DocumentMetadata): Promise<DocumentMetadata>;
  getDocument(id: string): Promise<DocumentMetadata | undefined>;
  getUserDocuments(userId: number): Promise<DocumentMetadata[]>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
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
        .where(eq(users.username, username))
        .limit(1);
      return user;
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return user;
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      console.log('Creating user:', { ...insertUser, password: '[REDACTED]' });
      const [user] = await db
        .insert(users)
        .values({
          ...insertUser,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      console.log('User created successfully:', { id: user.id });
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    try {
      const [user] = await db
        .update(users)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(users.id, id))
        .returning();
      return user;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Document-related methods
  private documents: Map<string, DocumentMetadata> = new Map();

  async saveDocument(document: DocumentMetadata): Promise<DocumentMetadata> {
    this.documents.set(document.id, document);
    return document;
  }

  async getDocument(id: string): Promise<DocumentMetadata | undefined> {
    return this.documents.get(id);
  }

  async getUserDocuments(userId: number): Promise<DocumentMetadata[]> {
    return Array.from(this.documents.values())
      .filter(doc => doc.userId === userId);
  }
}

export const storage = new DatabaseStorage();