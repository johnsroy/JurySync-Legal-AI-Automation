import { Router } from "express";
import multer from "multer";
import path from "path";
import { scanDocument } from "../services/complianceMonitor";

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

// Store compliance results in memory (replace with database in production)
const complianceResults = new Map();

router.post('/api/compliance/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = req.file.buffer.toString();
    const fileType = path.extname(req.file.originalname).substring(1);

    console.log(`[Compliance] Scanning document of type: ${fileType}`);
    const result = await scanDocument(fileContent, fileType);
    
    // Store the result
    complianceResults.set(req.file.originalname, result);
    
    console.log(`[Compliance] Scan completed with risk level: ${result.riskLevel}`);
    res.json(result);
  } catch (error: any) {
    console.error('[Compliance] Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process document',
      details: error.message 
    });
  }
});

router.get('/api/compliance/results', (req, res) => {
  try {
    const results = Array.from(complianceResults.values());
    res.json(results);
  } catch (error: any) {
    console.error('[Compliance] Results fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch compliance results',
      details: error.message 
    });
  }
});

export default router;
