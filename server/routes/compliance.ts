import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { complianceDocuments, complianceIssues, complianceFiles } from "@shared/schema";
import { analyzeDocument } from "../services/complianceMonitor";
import { saveUploadedFile } from "../services/fileUploadService";
import { eq } from "drizzle-orm";

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/png',
      'image/jpeg'
    ];

    console.log('[Compliance] Received file:', file.originalname, 'type:', file.mimetype);

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types are: PDF, DOC, DOCX, TXT, PNG, and JPEG`));
    }
  }
}).single('file'); // Move .single() to be part of the middleware

// Upload endpoint with proper error handling
router.post('/upload', async (req, res) => {
  console.log('[Compliance] Received upload request');

  try {
    // Get user ID from session
    const userId = (req as any).user?.id;
    if (!userId) {
      console.log('[Compliance] No user ID found in session');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Handle file upload with multer
    await new Promise<void>((resolve, reject) => {
      upload(req, res, (err) => {
        if (err) {
          console.error('[Compliance] Multer error:', err);
          reject(err);
        } else {
          console.log('[Compliance] Multer processed file successfully');
          resolve();
        }
      });
    });

    if (!req.file) {
      console.log('[Compliance] No file found in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`[Compliance] Processing upload: ${req.file.originalname} (${req.file.size} bytes)`);

    // Save file using the upload service
    const fileRecord = await saveUploadedFile(req.file, userId);
    console.log(`[Compliance] File saved: ${fileRecord.id}`);

    // Create compliance document record
    const [document] = await db
      .insert(complianceDocuments)
      .values({
        userId,
        title: req.file.originalname,
        content: req.file.buffer.toString(),
        documentType: req.file.mimetype,
        status: "PENDING"
      })
      .returning();

    console.log(`[Compliance] Document created: ${document.id}`);

    // Start analysis in background
    analyzeDocument(document.id.toString())
      .catch(error => {
        console.error(`[Compliance] Analysis failed for document ${document.id}:`, error);
        db.update(complianceDocuments)
          .set({ status: "ERROR" })
          .where(eq(complianceDocuments.id, document.id))
          .execute()
          .catch(updateError => {
            console.error(`Failed to update document status:`, updateError);
          });
      });

    res.json({
      success: true,
      fileId: fileRecord.id,
      documentId: document.id,
      status: "PENDING",
      message: "Document uploaded and queued for analysis"
    });

  } catch (error: any) {
    console.error('[Compliance] Upload failed:', error);

    // Ensure we always return JSON, even for errors
    const status = error.status || 500;
    const message = error.code === 'LIMIT_FILE_SIZE' 
      ? 'File too large. Maximum size is 50MB'
      : error.code === 'LIMIT_UNEXPECTED_FILE'
      ? 'Invalid file type'
      : error.message || 'Upload failed';

    res.status(status).json({ 
      success: false,
      error: message
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