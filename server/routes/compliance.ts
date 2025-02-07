import { Router } from "express";
import multer from "multer";
import path from "path";
import { db } from "../db";
import { complianceDocuments, complianceIssues } from "@shared/schema";
import { analyzeDocument } from "../services/complianceMonitor";
import { eq } from "drizzle-orm";

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (_, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    console.log(`[Compliance] Received file: ${file.originalname}, type: ${file.mimetype}`);

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types are: PDF, DOC, DOCX, and TXT`));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Upload and analyze document
router.post('/api/compliance/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded');
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    console.log(`[Compliance] Processing file: ${req.file.originalname}`);

    // Verify file content
    if (!req.file.buffer || req.file.buffer.length === 0) {
      throw new Error('Empty file content');
    }

    const fileContent = req.file.buffer.toString();
    if (!fileContent || fileContent.trim().length === 0) {
      throw new Error('Empty file content after conversion');
    }

    // Store document in database
    const [document] = await db
      .insert(complianceDocuments)
      .values({
        userId,
        title: req.file.originalname,
        content: fileContent,
        documentType: path.extname(req.file.originalname).substring(1),
        status: "PENDING"
      })
      .returning();

    console.log(`[Compliance] Document stored with ID: ${document.id}`);

    // Start analysis in background
    analyzeDocument(document.id.toString())
      .catch(error => console.error(`[Compliance] Analysis failed for document ${document.id}:`, error));

    res.json({
      documentId: document.id,
      status: "PENDING",
      message: "Document uploaded successfully and queued for analysis"
    });
  } catch (error: any) {
    console.error('[Compliance] Upload error:', error);
    res.status(500).json({
      error: 'Failed to process document',
      details: error.message
    });
  }
});

// Get all documents for current user
router.get('/api/compliance/documents', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const documents = await db
      .select({
        id: complianceDocuments.id,
        title: complianceDocuments.title,
        status: complianceDocuments.status,
        riskScore: complianceDocuments.riskScore,
        lastScanned: complianceDocuments.lastScanned,
        createdAt: complianceDocuments.createdAt
      })
      .from(complianceDocuments)
      .where(eq(complianceDocuments.userId, userId));

    console.log(`[Compliance] Found ${documents.length} documents for user ${userId}`);
    res.json(documents);
  } catch (error: any) {
    console.error('[Compliance] Documents fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch documents',
      details: error.message
    });
  }
});

// Get compliance issues for a document
router.get('/api/compliance/issues/:documentId', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const documentId = parseInt(req.params.documentId);
    const issues = await db
      .select()
      .from(complianceIssues)
      .where(eq(complianceIssues.documentId, documentId));

    res.json(issues);
  } catch (error: any) {
    console.error('[Compliance] Issues fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch compliance issues',
      details: error.message
    });
  }
});

// Update issue status
router.patch('/api/compliance/issues/:issueId', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { status } = req.body;
    if (!status || !['OPEN', 'IN_REVIEW', 'RESOLVED'].includes(status)) {
      throw new Error('Invalid status');
    }

    const issueId = parseInt(req.params.issueId);
    await db
      .update(complianceIssues)
      .set({ status })
      .where(eq(complianceIssues.id, issueId));

    res.json({ message: 'Issue status updated successfully' });
  } catch (error: any) {
    console.error('[Compliance] Issue update error:', error);
    res.status(500).json({
      error: 'Failed to update issue',
      details: error.message
    });
  }
});

export default router;