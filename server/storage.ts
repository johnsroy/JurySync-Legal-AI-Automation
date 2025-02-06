import { User, Document } from "@shared/schema";
import type { InsertUser } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getDocuments(userId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(document: Omit<Document, "id" | "createdAt">): Promise<Document>;
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private documents: Map<number, Document>;
  sessionStore: session.Store;
  private userId: number;
  private documentId: number;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.userId = 1;
    this.documentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getDocuments(userId: number): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      (doc) => doc.userId === userId,
    );
  }

  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async createDocument(
    document: Omit<Document, "id" | "createdAt">,
  ): Promise<Document> {
    const id = this.documentId++;
    const createdAt = new Date();
    const newDocument = { ...document, id, createdAt };
    this.documents.set(id, newDocument);
    return newDocument;
  }
}

export const storage = new MemStorage();
