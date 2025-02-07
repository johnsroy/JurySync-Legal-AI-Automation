import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { complianceDocuments, complianceFiles } from "@shared/schema";
import { analyzeDocument } from "../services/complianceMonitor";
import { saveUploadedFile } from "../services/fileUploadService";
import { eq } from "drizzle-orm";

const router = Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    console.log('[Compliance] Processing file:', file.originalname, 'type:', file.mimetype);

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types are: PDF, DOC, DOCX, and TXT`));
    }
  }
});

// Upload endpoint with proper error handling
router.post('/api/compliance/upload', (req, res, next) => {
  console.log('[Compliance] Starting upload process');

  upload.single('file')(req, res, async (err) => {
    try {
      if (err) {
        console.error('[Compliance] Multer error:', err);
        return res.status(400).json({ 
          error: err.message || 'File upload failed'
        });
      }

      // Check authentication
      const userId = (req as any).user?.id;
      if (!userId) {
        console.log('[Compliance] Authentication failed - no user ID');
        return res.status(401).json({ error: 'Not authenticated' });
      }

      if (!req.file) {
        console.log('[Compliance] No file in request');
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log(`[Compliance] Processing file: ${req.file.originalname} (${req.file.size} bytes)`);

      // Save file using the upload service
      const fileRecord = await saveUploadedFile(req.file, userId);
      console.log(`[Compliance] File saved with ID: ${fileRecord.id}`);

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

      console.log(`[Compliance] Document created with ID: ${document.id}`);

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
      next(error);
    }
  });
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

export default router;