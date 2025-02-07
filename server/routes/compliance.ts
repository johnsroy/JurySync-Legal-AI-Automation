import { Router } from "express";
import multer from "multer";
import path from "path";
import { scanDocument, startMonitoring, getMonitoringResults } from "../services/complianceMonitor";

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

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Store uploaded documents in memory (replace with database in production)
const uploadedDocuments = new Map();

router.post('/api/compliance/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = req.file.buffer.toString();
    const fileType = path.extname(req.file.originalname).substring(1);
    const documentId = Date.now().toString();

    // Store document info
    uploadedDocuments.set(documentId, {
      id: documentId,
      name: req.file.originalname,
      content: fileContent,
      type: fileType,
      uploadedAt: new Date().toISOString(),
      status: "PENDING"
    });

    console.log(`[Compliance] Scanning document of type: ${fileType}`);
    const result = await scanDocument(fileContent, fileType);

    // Update document status
    const doc = uploadedDocuments.get(documentId);
    if (doc) {
      doc.status = "MONITORING";
    }

    console.log(`[Compliance] Scan completed with risk level: ${result.riskLevel}`);
    res.json({ documentId, result });
  } catch (error: any) {
    console.error('[Compliance] Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process document',
      details: error.message 
    });
  }
});

router.get('/api/compliance/documents', (req, res) => {
  try {
    const documents = Array.from(uploadedDocuments.values()).map(({ id, name, uploadedAt, status }) => ({
      id,
      name,
      uploadedAt,
      status
    }));
    res.json(documents);
  } catch (error: any) {
    console.error('[Compliance] Documents fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch documents',
      details: error.message 
    });
  }
});

router.get('/api/compliance/results', (req, res) => {
  try {
    const documentIds = req.query.documents?.toString().split(',');
    const results = getMonitoringResults(documentIds);
    res.json(results);
  } catch (error: any) {
    console.error('[Compliance] Results fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch compliance results',
      details: error.message 
    });
  }
});

router.post('/api/compliance/monitor', async (req, res) => {
  try {
    const { documentIds } = req.body;
    if (!Array.isArray(documentIds)) {
      return res.status(400).json({ error: 'Document IDs must be an array' });
    }

    const documents = documentIds
      .map(id => {
        const doc = uploadedDocuments.get(id);
        return doc ? {
          id: doc.id,
          content: doc.content,
          type: doc.type
        } : null;
      })
      .filter(Boolean);

    if (documents.length === 0) {
      return res.status(404).json({ error: 'No valid documents found' });
    }

    // Update status for selected documents
    documentIds.forEach(id => {
      const doc = uploadedDocuments.get(id);
      if (doc) {
        doc.status = "MONITORING";
      }
    });

    const results = await startMonitoring(documents);
    res.json(results);
  } catch (error: any) {
    console.error('[Compliance] Monitoring error:', error);
    res.status(500).json({ 
      error: 'Failed to start monitoring',
      details: error.message 
    });
  }
});

export default router;