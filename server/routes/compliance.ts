import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { complianceDocuments, complianceIssues } from "@shared/schema";
import { analyzePDFContent } from "../services/fileAnalyzer";
import { riskAssessmentService } from "../services/riskAssessment";
import { eq } from "drizzle-orm";

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_, file, cb) => {
    // Accept both PDF and DOCX
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are supported'));
    }
  }
});

router.post('/api/compliance/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    try {
      // Set JSON content type header
      res.setHeader('Content-Type', 'application/json');

      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      if (!req.file) {
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

      // Start PDF analysis and risk assessment in background
      analyzePDFContent(req.file.buffer, document.id)
        .then(async (content) => {
          // Update document with extracted content
          await db
            .update(complianceDocuments)
            .set({ content })
            .where(eq(complianceDocuments.id, document.id));

          // Perform risk assessment
          await riskAssessmentService.assessDocument(document.id, content);
        })
        .catch(error => {
          console.error(`Analysis failed for document ${document.id}:`, error);
          db.update(complianceDocuments)
            .set({ status: "ERROR" })
            .where(eq(complianceDocuments.id, document.id))
            .execute()
            .catch(updateError => {
              console.error('Failed to update document status:', updateError);
            });
        });

      res.json({
        success: true,
        documentId: document.id,
        title: req.file.originalname,
        status: 'PENDING'
      });

    } catch (error: any) {
      console.error('Upload error:', error);
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
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const documents = await db
      .select({
        id: complianceDocuments.id,
        title: complianceDocuments.title,
        status: complianceDocuments.status,
        lastScanned: complianceDocuments.lastScanned,
        riskScore: complianceDocuments.riskScore 
      })
      .from(complianceDocuments)
      .where(eq(complianceDocuments.userId, userId));

    res.json(documents);
  } catch (error: any) {
    console.error('Documents fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get risk assessment results for a document
router.get('/api/compliance/documents/:id/risks', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const documentId = parseInt(req.params.id);
    const risks = await riskAssessmentService.getDocumentRisks(documentId);

    res.json(risks);
  } catch (error: any) {
    console.error('Risk assessment fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;