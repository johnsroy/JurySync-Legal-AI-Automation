import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { complianceDocuments } from "@shared/schema";
import { analyzePDFContent } from "../services/fileAnalyzer";
import path from "path";

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

router.post('/api/compliance/upload', (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    try {
      if (err) {
        res.setHeader('Content-Type', 'text/plain');
        return res.status(400).send(err.message);
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        res.setHeader('Content-Type', 'text/plain');
        return res.status(401).send('Not authenticated');
      }

      if (!req.file) {
        res.setHeader('Content-Type', 'text/plain');
        return res.status(400).send('No file uploaded');
      }

      // Create document record first
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

      // Send plain text response
      res.setHeader('Content-Type', 'text/plain');
      res.send(`Document uploaded successfully. ID: ${document.id}`);

    } catch (error: any) {
      next(error);
    }
  });
});

// Get all documents for current user - returns plain text for compatibility
router.get('/api/compliance/documents', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(401).send('Not authenticated');
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

    // Format as plain text
    const textResponse = documents
      .map(doc => `ID: ${doc.id}, Title: ${doc.title}, Status: ${doc.status}`)
      .join('\n');

    res.setHeader('Content-Type', 'text/plain');
    res.send(textResponse);
  } catch (error: any) {
    console.error('Documents fetch error:', error);
    res.setHeader('Content-Type', 'text/plain');
    res.status(500).send('Failed to fetch documents');
  }
});

export default router;