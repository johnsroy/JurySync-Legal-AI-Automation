import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { vaultDocuments, users } from "@shared/schema";
import { legalResearchService } from "../services/legalResearchService";
import { eq } from "drizzle-orm";

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

// Check if user has required role
const checkRole = (allowedRoles: string[]) => async (req: any, res: any, next: any) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));

  if (!user || !allowedRoles.includes(user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  next();
};

// Upload document
router.post('/documents', checkRole(['ADMIN', 'LAWYER']), async (req, res) => {
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
    const analysis = await legalResearchService.analyzeDocument(content);
    
    // Store document with AI insights
    const [document] = await db
      .insert(vaultDocuments)
      .values({
        userId,
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
        }
      })
      .returning();

    return res.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        documentType: document.documentType,
        aiSummary: document.aiSummary,
        createdAt: document.createdAt
      }
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Get all documents
router.get('/documents', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const documents = await db
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
    const [document] = await db
      .select()
      .from(vaultDocuments)
      .where(eq(vaultDocuments.id, documentId));

    if (!document || document.userId !== userId) {
      return res.status(404).json({ error: 'Document not found' });
    }

    return res.json({ document });

  } catch (error: any) {
    console.error('Document fetch error:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
