import { type User } from "@shared/schema";
import { type InsertUser } from "@shared/schema";
import session from "express-session";
import { db, usersCollection } from "./firebase";
import { FirebaseError } from "firebase-admin";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User>;
  sessionStore: session.Store;
}

// Firebase Session Store implementation
class FirebaseSessionStore extends session.Store {
  private collection = db.collection('sessions');

  async get(sid: string, callback: (err: any, session?: any) => void): Promise<void> {
    try {
      const doc = await this.collection.doc(sid).get();
      const session = doc.exists ? JSON.parse(doc.data()!.session) : null;
      callback(null, session);
    } catch (error) {
      console.error('Error getting session:', error);
      callback(error);
    }
  }

  async set(sid: string, session: any, callback?: (err?: any) => void): Promise<void> {
    try {
      const sessionStr = JSON.stringify(session);
      await this.collection.doc(sid).set({
        session: sessionStr,
        expires: session.cookie?.expires || new Date(Date.now() + 86400000) // 24h default
      });
      callback?.();
    } catch (error) {
      console.error('Error setting session:', error);
      callback?.(error);
    }
  }

  async destroy(sid: string, callback?: (err?: any) => void): Promise<void> {
    try {
      await this.collection.doc(sid).delete();
      callback?.();
    } catch (error) {
      console.error('Error destroying session:', error);
      callback?.(error);
    }
  }

  async touch(sid: string, session: any, callback?: (err?: any) => void): Promise<void> {
    try {
      await this.collection.doc(sid).update({
        expires: session.cookie?.expires || new Date(Date.now() + 86400000)
      });
      callback?.();
    } catch (error) {
      console.error('Error touching session:', error);
      callback?.(error);
    }
  }
}

export class FirebaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new FirebaseSessionStore();
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const snapshot = await usersCollection.where('id', '==', id).limit(1).get();
      if (snapshot.empty) return undefined;
      const userData = snapshot.docs[0].data();
      return this.convertToUser(userData);
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const snapshot = await usersCollection.where('username', '==', username).limit(1).get();
      if (snapshot.empty) return undefined;
      const userData = snapshot.docs[0].data();
      return this.convertToUser(userData);
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const snapshot = await usersCollection.where('email', '==', email).limit(1).get();
      if (snapshot.empty) return undefined;
      const userData = snapshot.docs[0].data();
      return this.convertToUser(userData);
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      console.log('Creating user:', { ...insertUser, password: '[REDACTED]' });

      // Generate a numeric ID for the user
      const counterDoc = await db.collection('counters').doc('users').get();
      let nextId = 1;

      if (counterDoc.exists) {
        nextId = (counterDoc.data()?.value || 0) + 1;
      }

      await db.collection('counters').doc('users').set({ value: nextId });

      const user: User = {
        ...insertUser,
        id: nextId,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUploadDate: null,
        uploadCount: 0,
        profileImage: null,
        role: 'USER',
        firstName: null,
        lastName: null,
        subscriptionStatus: 'INACTIVE',
        subscriptionEndsAt: null,
        trialUsed: false,
        stripeCustomerId: null,
        stripePriceId: null
      };

      await usersCollection.doc(nextId.toString()).set(user);
      console.log('User created successfully:', { id: user.id });
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    try {
      const userRef = usersCollection.doc(id.toString());
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const updatedUser = {
        ...userDoc.data(),
        ...updates,
        updatedAt: new Date()
      };

      await userRef.update(updatedUser);
      return this.convertToUser(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  private convertToUser(data: FirebaseFirestore.DocumentData): User {
    return {
      id: data.id,
      username: data.username,
      email: data.email,
      password: data.password,
      role: data.role || 'USER',
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      profileImage: data.profileImage || null,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      lastUploadDate: data.lastUploadDate ? data.lastUploadDate.toDate() : null,
      uploadCount: data.uploadCount || 0,
      subscriptionStatus: data.subscriptionStatus || 'INACTIVE',
      subscriptionEndsAt: data.subscriptionEndsAt ? data.subscriptionEndsAt.toDate() : null,
      trialUsed: data.trialUsed || false,
      stripeCustomerId: data.stripeCustomerId || null,
      stripePriceId: data.stripePriceId || null
    };
  }
}

export const storage = new FirebaseStorage();