import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { complianceDocuments } from "@shared/schema";
import { analyzePDFContent } from "../services/fileAnalyzer";

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_, file, cb) => {
    // Only accept PDFs for direct analysis
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are supported'));
    }
  }
});

router.post('/api/compliance/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    try {
      if (err) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: err.message });
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(401).json({ error: 'Not authenticated' });
      }

      if (!req.file) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Create document record
      const [document] = await db
        .insert(complianceDocuments)
        .values({
          userId,
          title: req.file.originalname,
          content: '', // Will be populated after analysis
          documentType: req.file.mimetype,
          status: "PENDING"
        })
        .returning();

      // Start PDF analysis in background
      analyzePDFContent(req.file.buffer, document.id)
        .catch(error => {
          console.error(`Analysis failed for document ${document.id}:`, error);
        });

      // Send JSON response
      res.setHeader('Content-Type', 'application/json');
      res.json({
        success: true,
        documentId: document.id,
        title: req.file.originalname,
        status: 'PENDING'
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ 
        error: error.message || 'Upload failed'
      });
    }
  });
});

// Get all documents for current user
router.get('/api/compliance/documents', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const documents = await db
      .select({
        id: complianceDocuments.id,
        title: complianceDocuments.title,
        status: complianceDocuments.status,
        lastScanned: complianceDocuments.lastScanned,
      })
      .from(complianceDocuments)
      .where(eq(complianceDocuments.userId, userId));

    res.setHeader('Content-Type', 'application/json');
    res.json(documents);
  } catch (error: any) {
    console.error('Documents fetch error:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: error.message });
  }
});

export default router;