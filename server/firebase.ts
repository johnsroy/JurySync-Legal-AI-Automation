import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { ServiceAccount } from 'firebase-admin';

// Initialize Firebase Admin with environment variables
const serviceAccount: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

// Validate Firebase configuration
if (!serviceAccount.projectId || !serviceAccount.privateKey || !serviceAccount.clientEmail) {
  throw new Error('Missing required Firebase configuration. Please check environment variables.');
}

console.log('Initializing Firebase Admin with project:', serviceAccount.projectId);

// Initialize Firebase Admin SDK
const app = initializeApp({
  credential: cert(serviceAccount),
});

export const db = getFirestore(app);

// Collection references
export const usersCollection = db.collection('users');
export const documentsCollection = db.collection('documents');
export const analysisCollection = db.collection('analysis');
export const sessionsCollection = db.collection('sessions');

// Document type definitions remain unchanged
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

// Firestore data converters remain unchanged
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

// Initialize collections on startup
export async function initializeFirestore() {
  console.log('Starting Firestore initialization...');

  try {
    // First verify database connection
    const dbTest = await db.collection('_test').doc('_test').get();
    console.log('Database connection verified:', dbTest.exists ? 'exists' : 'does not exist');

    // Create the collections if they don't exist by adding a placeholder document
    const initPromises = [
      usersCollection.doc('_config').set({ initialized: true, timestamp: new Date() }, { merge: true }),
      documentsCollection.doc('_config').set({ initialized: true, timestamp: new Date() }, { merge: true }),
      analysisCollection.doc('_config').set({ initialized: true, timestamp: new Date() }, { merge: true }),
      sessionsCollection.doc('_config').set({ initialized: true, timestamp: new Date() }, { merge: true })
    ];

    // Initialize counters collection
    const countersRef = db.collection('counters').doc('users');
    const counterDoc = await countersRef.get();
    if (!counterDoc.exists) {
      await countersRef.set({ value: 0, timestamp: new Date() });
      console.log('Initialized counters collection');
    }

    await Promise.all(initPromises);
    console.log('All Firebase collections initialized successfully');

    return true;
  } catch (error) {
    console.error('Error initializing Firebase collections:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
    throw error;
  }
}

// Initialize on import
initializeFirestore().catch(error => {
  console.error('Failed to initialize Firestore on import:', error);
});