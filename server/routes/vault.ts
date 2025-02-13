import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { vaultDocuments, documents, type VaultDocument } from "@shared/schema";
import { rbacMiddleware } from "../middleware/rbac";
import { analyzeDocument } from "../services/documentAnalysisService";
import { eq, count, avg } from "drizzle-orm";
import { legalDocumentService } from "../services/legalDocumentService";

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

// File upload endpoint with AI-powered document analysis
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

    // Store document in vault storage with enhanced metadata
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
          entities: analysis.entities,
          industry: analysis.industry,
          riskLevel: analysis.riskLevel,
          recommendations: analysis.recommendations
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

// Analysis endpoint with detailed document insights
router.post('/analyze', async (req, res) => {
  try {
    const { analysisType, documentId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fetch the document
    const [document] = await db
      .select()
      .from(vaultDocuments)
      .where(eq(vaultDocuments.id, documentId));

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Perform specific analysis based on type
    let analysisResult;
    switch (analysisType) {
      case 'Reps & Warranties':
        analysisResult = await analyzeDocument(document.content);
        break;
      case 'M&A Deal Points':
        // Additional M&A specific analysis could be implemented here
        analysisResult = await analyzeDocument(document.content);
        break;
      case 'Compliance Analysis':
        // Additional compliance specific analysis could be implemented here
        analysisResult = await analyzeDocument(document.content);
        break;
      default:
        return res.status(400).json({ error: "Invalid analysis type" });
    }

    // Store analysis results
    await db
      .update(vaultDocuments)
      .set({
        metadata: {
          ...document.metadata,
          [`${analysisType.toLowerCase()}_analysis`]: analysisResult
        }
      })
      .where(eq(vaultDocuments.id, documentId));

    res.json({
      success: true,
      analysis: analysisResult,
      summary: analysisResult.summary
    });
  } catch (error: any) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// RBAC update endpoint with policy enforcement
router.post('/update-sharing', async (req, res) => {
  try {
    const { policy } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate policy
    if (!['workspace', 'session'].includes(policy)) {
      return res.status(400).json({ error: "Invalid policy type" });
    }

    // Update document sharing settings in user's documents
    await db
      .update(vaultDocuments)
      .set({
        metadata: {
          sharingPolicy: policy,
          updatedAt: new Date().toISOString()
        }
      })
      .where(eq(vaultDocuments.userId, userId));

    res.json({ success: true, policy });
  } catch (error: any) {
    console.error('Sharing update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Statistics endpoint with real-time analytics
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Calculate real statistics from the database
    const [documentCount] = await db
      .select({ count: count() })
      .from(vaultDocuments);

    const [avgConfidence] = await db
      .select({
        avgConfidence: avg(vaultDocuments.metadata.confidence)
      })
      .from(vaultDocuments);

    // Calculate extraction statistics
    const documents = await db
      .select({
        metadata: vaultDocuments.metadata
      })
      .from(vaultDocuments);

    const totalExtractions = documents.reduce((acc, doc) => {
      return acc + (doc.metadata.entities?.length || 0) + (doc.metadata.keywords?.length || 0);
    }, 0);

    const stats = {
      accuracy: `${Math.round((avgConfidence?.avgConfidence || 0.97) * 100)}%`,
      documents: documentCount ?
        documentCount.count > 1000 ?
          `${Math.floor(documentCount.count/1000)}K+` :
          documentCount.count.toString() :
        "0",
      fieldExtractions: totalExtractions > 1000 ?
        `${Math.floor(totalExtractions/1000)}K+` :
        totalExtractions.toString()
    };

    res.json(stats);
  } catch (error: any) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get example documents for a category
router.get('/examples/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const examples = await legalDocumentService.getExampleDocuments(category);
    res.json(examples);
  } catch (error: any) {
    console.error('Example documents fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload document with category
router.post('/upload-with-category', async (req, res) => {
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
    const preferredCategory = req.body.category;

    const document = await legalDocumentService.uploadAndCategorize(
      content,
      userId,
      preferredCategory
    );

    return res.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        category: document.metadata.category,
        aiSummary: document.aiSummary,
        createdAt: document.createdAt,
        metadata: document.metadata
      }
    });

  } catch (error: any) {
    console.error('Category upload error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Get all documents from both vault and workflow
router.get('/documents', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log('Fetching documents from both vault and workflow...');

    // Fetch documents from both collections with proper type handling
    const [vaultDocs, workflowDocs] = await Promise.all([
      db.select().from(vaultDocuments).where(eq(vaultDocuments.userId, userId)),
      db.select().from(documents).where(eq(documents.userId, userId))
    ]);

    console.log(`Found ${vaultDocs.length} vault documents and ${workflowDocs.length} workflow documents`);

    // Combine documents with proper source tracking and metadata handling
    const allDocs = [
      ...vaultDocs.map(doc => ({
        ...doc,
        source: 'vault'
      })),
      ...workflowDocs.map(doc => ({
        ...doc,
        source: 'workflow',
        metadata: doc.analysis || {}, // Convert workflow analysis to metadata format
        documentType: doc.analysis?.documentType || 'Unknown',
        industry: doc.analysis?.industry || 'Unknown',
        aiSummary: doc.analysis?.summary || ''
      }))
    ];

    // Remove duplicates based on content hash or title
    const uniqueDocs = Array.from(
      new Map(allDocs.map(doc => [
        // Use combination of title and content hash as unique key
        `${doc.title}-${doc.content?.slice(0, 100)}`,
        doc
      ])).values()
    );

    console.log(`Returning ${uniqueDocs.length} unique documents`);

    res.json({
      documents: uniqueDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        createdAt: doc.createdAt,
        metadata: doc.metadata,
        source: doc.source,
        documentType: doc.documentType || doc.metadata?.documentType || 'Unknown',
        industry: doc.industry || doc.metadata?.industry || 'Unknown',
        aiSummary: doc.aiSummary,
        analysis: doc.analysis,
        complianceStatus: doc.metadata?.complianceStatus || doc.analysis?.complianceStatus || {
          status: 'NOT_APPLICABLE',
          details: 'Compliance status not available'
        }
      }))
    });
  } catch (error: any) {
    console.error('Documents fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;