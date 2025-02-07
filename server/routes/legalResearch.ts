import { Router } from 'express';
import { legalResearchService } from '../services/legalResearchService';
import type { InsertLegalDocument } from '@shared/schema';
import multer from 'multer';
import { z } from 'zod';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
}).single('file');

// Validation schema for document upload
const documentUploadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  documentType: z.string().min(1, "Document type is required"),
  jurisdiction: z.string().min(1, "Jurisdiction is required"),
  date: z.string().transform(str => new Date(str))
});

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

    const validatedData = documentUploadSchema.parse(req.body);

    const document: InsertLegalDocument = {
      title: validatedData.title,
      content: req.file.buffer.toString('utf-8'),
      documentType: validatedData.documentType,
      jurisdiction: validatedData.jurisdiction,
      date: validatedData.date,
      status: 'ACTIVE',
      metadata: {},
      citations: []
    };

    await legalResearchService.addDocument(document);
    res.json({ success: true, message: 'Document added successfully' });

  } catch (error: any) {
    console.error('Document upload error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Query validation schema
const querySchema = z.object({
  query: z.string().min(1, "Query is required")
});

// Perform legal research query
router.post('/query', async (req, res) => {
  try {
    const { query } = querySchema.parse(req.body);
    const results = await legalResearchService.analyzeQuery(query);
    res.json(results);

  } catch (error: any) {
    console.error('Query analysis error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
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