import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

const app = initializeApp({
  credential: cert(serviceAccount),
});

export const db = getFirestore(app);

// Collection references
export const usersCollection = db.collection('users');
export const documentsCollection = db.collection('documents');
export const analysisCollection = db.collection('analysis');

// Firestore data converters
export const documentConverter = {
  toFirestore: (data: any) => {
    return {
      title: data.title,
      content: data.content,
      createdAt: data.createdAt || new Date(),
      userId: data.userId,
      fileName: data.fileName,
      analysis: data.analysis || null
    };
  },
  fromFirestore: (snapshot: FirebaseFirestore.QueryDocumentSnapshot) => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      title: data.title,
      content: data.content,
      createdAt: data.createdAt.toDate(),
      userId: data.userId,
      fileName: data.fileName,
      analysis: data.analysis
    };
  },
};

export const analysisConverter = {
  toFirestore: (data: any) => {
    return {
      documentId: data.documentId,
      fileName: data.fileName,
      fileDate: data.fileDate,
      documentType: data.documentType,
      industry: data.industry,
      complianceStatus: data.complianceStatus,
      details: data.details || null,
    };
  },
  fromFirestore: (snapshot: FirebaseFirestore.QueryDocumentSnapshot) => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      documentId: data.documentId,
      fileName: data.fileName,
      fileDate: data.fileDate instanceof Date ? data.fileDate : data.fileDate.toDate(),
      documentType: data.documentType,
      industry: data.industry,
      complianceStatus: data.complianceStatus,
      details: data.details,
    };
  },
};

// Apply converters to collections
documentsCollection.withConverter(documentConverter);
analysisCollection.withConverter(analysisConverter);

// Initialize counters collection if it doesn't exist
async function initializeCounters() {
  const countersRef = db.collection('counters').doc('users');
  const doc = await countersRef.get();
  if (!doc.exists) {
    await countersRef.set({ value: 0 });
  }
}

initializeCounters().catch(console.error);