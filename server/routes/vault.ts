import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { vaultDocuments, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { analyzeDocument } from "../services/documentAnalysisService";
import { rbacMiddleware } from "../middleware/rbac";

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are supported'));
    }
  }
}).single('file');

const router = Router();

// Apply RBAC middleware to all routes
router.use(rbacMiddleware());

// Upload document
router.post('/documents', async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      upload(req, res, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user?.id;
    const content = req.file.buffer.toString('utf-8');

    // Get AI insights
    const analysis = await analyzeDocument(content);

    // Store document with AI insights
    const [document] = await db
      .insert(vaultDocuments)
      .values({
        title: req.file.originalname,
        content,
        documentType: analysis.classification || 'OTHER',
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        aiSummary: analysis.summary,
        aiClassification: analysis.classification,
        metadata: {
          keywords: analysis.keywords,
          confidence: analysis.confidence,
          entities: analysis.entities
        },
        userId
      })
      .returning();

    return res.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        documentType: document.documentType,
        aiSummary: document.aiSummary,
        createdAt: document.createdAt,
        metadata: document.metadata
      }
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Get all documents - accessible by all authenticated users
router.get('/documents', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get user's role
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    // Query documents based on role
    let documents;
    if (user.role === 'ADMIN') {
      // Admins can see all documents
      documents = await db
        .select({
          id: vaultDocuments.id,
          title: vaultDocuments.title,
          documentType: vaultDocuments.documentType,
          aiSummary: vaultDocuments.aiSummary,
          aiClassification: vaultDocuments.aiClassification,
          createdAt: vaultDocuments.createdAt,
          metadata: vaultDocuments.metadata
        })
        .from(vaultDocuments)
        .orderBy(vaultDocuments.createdAt);
    } else {
      // Other users can only see their own documents
      documents = await db
        .select({
          id: vaultDocuments.id,
          title: vaultDocuments.title,
          documentType: vaultDocuments.documentType,
          aiSummary: vaultDocuments.aiSummary,
          aiClassification: vaultDocuments.aiClassification,
          createdAt: vaultDocuments.createdAt,
          metadata: vaultDocuments.metadata
        })
        .from(vaultDocuments)
        .where(eq(vaultDocuments.userId, userId))
        .orderBy(vaultDocuments.createdAt);
    }

    return res.json({ documents });

  } catch (error: any) {
    console.error('Documents fetch error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Get document by ID with AI insights
router.get('/documents/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const documentId = parseInt(req.params.id);

    // Get user's role
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    let document;
    if (user.role === 'ADMIN') {
      // Admins can access any document
      [document] = await db
        .select()
        .from(vaultDocuments)
        .where(eq(vaultDocuments.id, documentId));
    } else {
      // Other users can only access their own documents
      [document] = await db
        .select()
        .from(vaultDocuments)
        .where(eq(vaultDocuments.id, documentId))
        .where(eq(vaultDocuments.userId, userId));
    }

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    return res.json({ document });

  } catch (error: any) {
    console.error('Document fetch error:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;