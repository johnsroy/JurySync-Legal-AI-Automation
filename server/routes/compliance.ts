import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { complianceDocuments } from "@shared/schema";
import { analyzePDFContent } from "../services/fileAnalyzer";
import { riskAssessmentService } from "../services/riskAssessment";
import { monitorDocument } from "../services/complianceMonitor";
import { eq } from "drizzle-orm";
import { generateDashboardInsights } from "../services/dashboardAnalytics";
import { modelRouter } from "../services/modelRouter";

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
}).single('file');

router.post('/upload', async (req, res) => {
  // Ensure JSON responses
  res.type('application/json');

  try {
    // Handle file upload
    const uploadResult = await new Promise((resolve, reject) => {
      upload(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            reject({ status: 400, message: `Upload error: ${err.message}` });
          } else {
            reject({ status: 500, message: `Unknown upload error: ${err.message}` });
          }
        }
        resolve(req.file);
      });
    });

    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file type
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only PDF, DOC, DOCX, and TXT files are supported' 
      });
    }

    // Create document record
    const [document] = await db
      .insert(complianceDocuments)
      .values({
        userId,
        title: req.file.originalname,
        content: '',
        documentType: req.file.mimetype,
        status: "PENDING"
      })
      .returning();

    // Process document using ModelRouter
    const taskId = `compliance-${document.id}`;
    const systemPrompt = "You are a legal compliance expert. Analyze the provided document for compliance issues and provide a structured analysis.";

    modelRouter.processTask(taskId, "compliance-analysis", req.file.buffer.toString(), systemPrompt)
      .then(async (result) => {
        await db
          .update(complianceDocuments)
          .set({ 
            content: result.output,
            status: "MONITORING",
            lastScanned: new Date(),
            // Add model metrics
            riskScore: result.qualityScore * 100,
            metadata: JSON.stringify({
              modelUsed: result.modelUsed,
              processingTimeMs: result.processingTimeMs,
              qualityScore: result.qualityScore,
              ...result.metadata
            })
          })
          .where(eq(complianceDocuments.id, document.id));

        await riskAssessmentService.assessDocument(document.id, result.output);
      })
      .catch(error => {
        console.error(`Analysis failed for document ${document.id}:`, error);
        db.update(complianceDocuments)
          .set({ status: "ERROR" })
          .where(eq(complianceDocuments.id, document.id))
          .execute()
          .catch(err => console.error('Failed to update document status:', err));
      });

    return res.json({
      success: true,
      documentId: document.id,
      title: req.file.originalname,
      status: 'PENDING'
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    const status = error.status || 500;
    const message = error.message || 'Upload failed';
    return res.status(status).json({ error: message });
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
  } catch (error: any) {
    console.error('Metrics fetch error:', error);
    res.status(500).json({ error: error.message });
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

  } catch (error: any) {
    console.error('Monitor start error:', error);
    res.status(500).json({ error: error.message });
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

  } catch (error: any) {
    console.error('Monitor stop error:', error);
    res.status(500).json({ error: error.message });
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

  } catch (error: any) {
    console.error('Results fetch error:', error);
    res.status(500).json({ error: error.message });
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

router.get('/dashboard-insights', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const insights = await generateDashboardInsights();
    res.json(insights);
  } catch (error: any) {
    console.error('Dashboard insights error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;