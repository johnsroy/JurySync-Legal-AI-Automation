import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { ServiceAccount } from 'firebase-admin';

// Initialize Firebase Admin with environment variables
const serviceAccount: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

// Initialize Firebase Admin SDK
const app = initializeApp({
  credential: cert(serviceAccount),
});

export const db = getFirestore(app);

// Collection references
export const usersCollection = db.collection('users');
export const documentsCollection = db.collection('documents');
export const analysisCollection = db.collection('analysis');

// Document type definitions
export interface FirestoreDocument {
  title: string;
  content: string;
  createdAt: Date;
  userId: string;
  fileName: string;
  analysis: any | null;
}

export interface FirestoreAnalysis {
  documentId: string;
  fileName: string;
  fileDate: Date;
  documentType: string;
  industry: string;
  complianceStatus: string;
  details?: {
    findings: string[];
    scope: string | null;
    keyTerms: string[];
    recommendations: string[];
  } | null;
}

// Firestore data converters with proper typing
export const documentConverter = {
  toFirestore: (data: FirestoreDocument): FirebaseFirestore.DocumentData => {
    return {
      title: data.title,
      content: data.content,
      createdAt: data.createdAt,
      userId: data.userId,
      fileName: data.fileName,
      analysis: data.analysis
    };
  },
  fromFirestore: (
    snapshot: FirebaseFirestore.QueryDocumentSnapshot
  ): FirestoreDocument => {
    const data = snapshot.data();
    return {
      title: data.title,
      content: data.content,
      createdAt: data.createdAt.toDate(),
      userId: data.userId,
      fileName: data.fileName,
      analysis: data.analysis
    };
  }
};

export const analysisConverter = {
  toFirestore: (data: FirestoreAnalysis): FirebaseFirestore.DocumentData => {
    return {
      documentId: data.documentId,
      fileName: data.fileName,
      fileDate: data.fileDate,
      documentType: data.documentType,
      industry: data.industry,
      complianceStatus: data.complianceStatus,
      details: data.details,
    };
  },
  fromFirestore: (
    snapshot: FirebaseFirestore.QueryDocumentSnapshot
  ): FirestoreAnalysis => {
    const data = snapshot.data();
    return {
      documentId: data.documentId,
      fileName: data.fileName,
      fileDate: data.fileDate instanceof Date ? data.fileDate : data.fileDate.toDate(),
      documentType: data.documentType,
      industry: data.industry,
      complianceStatus: data.complianceStatus,
      details: data.details,
    };
  }
};

// Apply converters to collections
documentsCollection.withConverter(documentConverter);
analysisCollection.withConverter(analysisConverter);

// Initialize counters collection
async function initializeCounters() {
  try {
    const countersRef = db.collection('counters').doc('users');
    const doc = await countersRef.get();
    if (!doc.exists) {
      await countersRef.set({ value: 0 });
      console.log('Initialized counters collection');
    }
  } catch (error) {
    console.error('Error initializing counters:', error);
  }
}

// Initialize collections on startup
export async function initializeFirestore() {
  try {
    await Promise.all([
      db.collection('users').doc('_config').set({ initialized: true }, { merge: true }),
      db.collection('sessions').doc('_config').set({ initialized: true }, { merge: true }),
      db.collection('documents').doc('_config').set({ initialized: true }, { merge: true }),
      db.collection('analysis').doc('_config').set({ initialized: true }, { merge: true }),
    ]);
    await initializeCounters();
    console.log('Firebase collections initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase collections:', error);
    throw error;
  }
}

// Initialize on import
initializeFirestore().catch(console.error);