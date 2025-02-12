import { Router } from "express";
import multer from "multer";
import { apiRequest } from "@/lib/queryClient";
import { db } from "../db";
import { vaultDocuments } from "@shared/schema";
import { rbacMiddleware } from "../middleware/rbac";
import { analyzeDocument } from "../services/documentAnalysisService";

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

// Apply RBAC middleware to all routes
router.use(rbacMiddleware());

// File upload endpoint
router.post('/upload', async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      upload(req, res, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const content = req.file.buffer.toString('utf-8');

    // Get AI insights using our document analysis service
    const analysis = await analyzeDocument(content);

    // Store document in vault storage
    const [document] = await db
      .insert(vaultDocuments)
      .values({
        title: req.file.originalname,
        content,
        documentType: analysis.classification,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        aiSummary: analysis.summary,
        aiClassification: analysis.classification,
        metadata: {
          keywords: analysis.keywords,
          confidence: analysis.confidence,
          entities: analysis.entities
        },
        userId
      })
      .returning();

    return res.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        documentType: document.documentType,
        aiSummary: document.aiSummary,
        createdAt: document.createdAt,
        metadata: document.metadata
      }
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Analysis endpoint
router.post('/analyze', async (req, res) => {
  try {
    const { analysisType } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Here you would integrate with your AI analysis service
    // For now, returning simulated analysis
    const analysisResult = {
      type: analysisType,
      summary: `Analysis of type ${analysisType} completed successfully`,
      details: {
        keyTerms: ["Governing Law", "Effective Date", "Termination Fee"],
        riskLevel: "LOW",
        recommendations: ["Review section 3.2", "Update compliance terms"]
      }
    };

    res.json(analysisResult);
  } catch (error: any) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// RBAC update endpoint
router.post('/update-sharing', async (req, res) => {
  try {
    const { policy } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Here you would update your RBAC policies
    // For now, just acknowledging the request
    res.json({ success: true, policy });
  } catch (error: any) {
    console.error('Sharing update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Statistics endpoint
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // For now, returning static statistics
    // In a production environment, you would calculate these from your database
    const stats = {
      accuracy: '97%',
      documents: '10K+',
      fieldExtractions: '50K+'
    };

    res.json(stats);
  } catch (error: any) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;