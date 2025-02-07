import { Router } from 'express';
import { legalResearchService } from '../services/legalResearchService';
import type { LegalDocument } from '@shared/schema';
import multer from 'multer';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
}).single('file');

// Upload and process legal document
router.post('/documents', async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      upload(req, res, (err) => {
        if (err) reject(err);
        else resolve(undefined);
      });
    });

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const document: LegalDocument = {
      title: req.body.title,
      content: req.file.buffer.toString('utf-8'),
      documentType: req.body.documentType,
      jurisdiction: req.body.jurisdiction,
      date: new Date(req.body.date),
      status: 'ACTIVE'
    };

    await legalResearchService.addDocument(document);
    res.json({ success: true, message: 'Document added successfully' });

  } catch (error: any) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Perform legal research query
router.post('/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = await legalResearchService.analyzeQuery(query);
    res.json(results);

  } catch (error: any) {
    console.error('Query analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search similar cases
router.get('/similar', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const results = await legalResearchService.searchSimilarCases(query);
    res.json(results);

  } catch (error: any) {
    console.error('Similar cases search error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
