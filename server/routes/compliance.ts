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

    console.log(`[Compliance] Received file: ${file.originalname}, type: ${file.mimetype}`);

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Store uploaded documents in memory (replace with database in production)
const uploadedDocuments = new Map<string, {
  id: string;
  name: string;
  content: string;
  type: string;
  uploadedAt: string;
  status: "PENDING" | "MONITORING" | "ERROR";
}>();

router.post('/api/compliance/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('[Compliance] No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`[Compliance] Processing file: ${req.file.originalname}`);

    const fileContent = req.file.buffer.toString();
    const fileType = path.extname(req.file.originalname).substring(1);
    const documentId = Date.now().toString();

    // Store document info with proper typing
    const documentInfo = {
      id: documentId,
      name: req.file.originalname,
      content: fileContent,
      type: fileType,
      uploadedAt: new Date().toISOString(),
      status: "PENDING" as const
    };

    uploadedDocuments.set(documentId, documentInfo);
    console.log(`[Compliance] Stored document with ID: ${documentId}`);

    // If this is the first document, start monitoring immediately
    if (uploadedDocuments.size === 1) {
      console.log(`[Compliance] First document uploaded, starting immediate monitoring`);
      try {
        const result = await scanDocument(fileContent, fileType);
        documentInfo.status = "MONITORING";
        console.log(`[Compliance] Initial monitoring completed for document ${documentId}`);
        return res.json({ 
          documentId,
          status: documentInfo.status,
          result 
        });
      } catch (error) {
        console.error(`[Compliance] Initial monitoring failed:`, error);
        documentInfo.status = "ERROR";
      }
    }

    res.json({ 
      documentId,
      status: documentInfo.status
    });
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
    console.log('[Compliance] Fetching all documents');
    const documents = Array.from(uploadedDocuments.values()).map(({ id, name, uploadedAt, status }) => ({
      id,
      name,
      uploadedAt,
      status
    }));
    console.log(`[Compliance] Found ${documents.length} documents:`, documents);
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
    console.log(`[Compliance] Fetching results for documents: ${documentIds?.join(', ')}`);

    // If no specific documents requested, get results for all documents
    const results = documentIds ? getMonitoringResults(documentIds) : getMonitoringResults();
    console.log(`[Compliance] Returning results:`, results);

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

    console.log(`[Compliance] Starting monitoring for documents: ${documentIds.join(', ')}`);

    const documents = documentIds
      .map(id => {
        const doc = uploadedDocuments.get(id);
        if (!doc) {
          console.log(`[Compliance] Document not found: ${id}`);
          return null;
        }
        return {
          id: doc.id,
          content: doc.content,
          type: doc.type
        };
      })
      .filter((doc): doc is { id: string; content: string; type: string } => doc !== null);

    if (documents.length === 0) {
      return res.status(404).json({ error: 'No valid documents found' });
    }

    // Update status for selected documents
    documentIds.forEach(id => {
      const doc = uploadedDocuments.get(id);
      if (doc) {
        doc.status = "MONITORING";
        console.log(`[Compliance] Updated status to MONITORING for document: ${id}`);
      }
    });

    const results = await startMonitoring(documents);
    console.log(`[Compliance] Monitoring results:`, results);
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