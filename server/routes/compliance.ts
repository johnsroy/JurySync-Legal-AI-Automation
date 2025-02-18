import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { riskAssessments, documents, metricsEvents } from "@shared/schema";
import { eq } from "drizzle-orm";

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
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

// Handle document upload
router.post('/upload', async (req, res) => {
  try {
    // Handle file upload
    await new Promise((resolve, reject) => {
      upload(req, res, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });

    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Create document record
    const [document] = await db
      .insert(documents)
      .values({
        title: req.file.originalname,
        content: req.file.buffer.toString('utf-8'),
        documentType: "REGULATION",
        jurisdiction: "US",
        status: "PENDING",
        metadata: { uploadedBy: userId }
      })
      .returning();

    // Track metrics
    await db.insert(metricsEvents).values({
      userId,
      modelId: 'compliance-upload',
      taskType: 'document_upload',
      processingTimeMs: 0,
      successful: true,
      costSavingEstimate: 0,
      metadata: {
        documentId: document.id,
        fileType: req.file.mimetype
      }
    });

    return res.json({
      success: true,
      documentId: document.id,
      message: 'Document uploaded successfully'
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Get document status
router.get('/document/:documentId', async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Document fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;