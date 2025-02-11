import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { complianceDocuments } from "@shared/schema";
import { complianceAuditService } from "../services/complianceAuditService";
import { riskAssessmentService } from "../services/riskAssessment";
import { modelRouter } from "../services/modelRouter";
import { monitorDocument, generateWeeklyAnalytics } from "../services/complianceMonitor";
import { eq } from "drizzle-orm";

const router = Router();

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
      .insert(complianceDocuments)
      .values({
        userId,
        title: req.file.originalname,
        content: req.file.buffer.toString('utf-8'),
        documentType: req.file.mimetype,
        status: "PENDING",
        riskScore: 0,
        lastScanned: null,
        nextScanDue: null
      })
      .returning();

    // Start analysis in background
    complianceAuditService
      .analyzeDocument(document.id, document.content)
      .catch(error => console.error('Analysis failed:', error));

    return res.json({
      success: true,
      documentId: document.id,
      message: 'Document uploaded and queued for analysis'
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Handle pasted document content
router.post('/analyze', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { content, title } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'No content provided' });
    }

    // Create document record
    const [document] = await db
      .insert(complianceDocuments)
      .values({
        userId,
        title: title || 'Pasted Document',
        content,
        documentType: 'text/plain',
        status: "PENDING",
        riskScore: 0,
        lastScanned: null,
        nextScanDue: null
      })
      .returning();

    // Start analysis in background
    complianceAuditService
      .analyzeDocument(document.id, content)
      .catch(error => console.error('Analysis failed:', error));

    return res.json({
      success: true,
      documentId: document.id,
      message: 'Document queued for analysis'
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Analysis error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Get analysis progress
router.get('/progress/:documentId', async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const progress = complianceAuditService.getAnalysisProgress(documentId);

    if (!progress) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    res.json(progress);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Progress check error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get document status
router.get('/document/:documentId', async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const [document] = await db
      .select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.id, documentId));

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

// Add model metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const metrics = await modelRouter.getMetrics();
    res.json(metrics);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Metrics fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start monitoring for documents
router.post('/monitor', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { documentIds } = req.body;
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'No documents specified for monitoring' });
    }

    // Update documents to monitoring status
    await db
      .update(complianceDocuments)
      .set({
        status: "MONITORING",
        nextScanDue: new Date() // Schedule immediate scan
      })
      .where(eq(complianceDocuments.userId, userId));

    // Start monitoring process for each document
    for (const documentId of documentIds) {
      monitorDocument(documentId).catch(error => {
        console.error(`Failed to start monitoring for document ${documentId}:`, error);
      });
    }

    res.json({ success: true, message: 'Monitoring started' });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Monitor start error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Stop monitoring for documents
router.post('/stop-monitoring', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { documentIds } = req.body;
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'No documents specified' });
    }

    // Update documents to stop monitoring
    await db
      .update(complianceDocuments)
      .set({ status: "PAUSED" })
      .where(eq(complianceDocuments.userId, userId));

    res.json({ success: true, message: 'Monitoring stopped' });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Monitor stop error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get monitoring results
router.get('/results', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { documentIds } = req.query;
    let documentsToCheck = [];

    if (documentIds) {
      documentsToCheck = (documentIds as string).split(',').map(Number);
    }

    // Get documents and their latest compliance issues
    const documents = await db
      .select({
        id: complianceDocuments.id,
        title: complianceDocuments.title,
        status: complianceDocuments.status,
        riskScore: complianceDocuments.riskScore,
        lastScanned: complianceDocuments.lastScanned,
        nextScanDue: complianceDocuments.nextScanDue
      })
      .from(complianceDocuments)
      .where(eq(complianceDocuments.userId, userId));

    res.json(documents);

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Results fetch error:', err);
    res.status(500).json({ error: err.message });
  }
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
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Documents fetch error:', err);
    res.status(500).json({ error: err.message });
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
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Risk assessment fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard-insights', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const insights = await generateWeeklyAnalytics();
    res.json(insights);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Dashboard insights error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;