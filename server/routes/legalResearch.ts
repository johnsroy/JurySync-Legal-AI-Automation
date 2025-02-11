import { Router } from 'express';
import { legalResearchService } from '../services/legalResearchService';
import { z } from 'zod';
import { db } from '../db';
import { legalDocuments } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import multer from 'multer';
import mammoth from 'mammoth';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
      return;
    }
    cb(null, true);
  }
}).single('file');

const router = Router();

// Query validation schema
const querySchema = z.object({
  query: z.string().min(1, "Query is required")
});

// Perform legal research query
router.post('/query', async (req, res) => {
  try {
    console.log('Received query request:', req.body);

    const { query } = querySchema.parse(req.body);
    const results = await legalResearchService.analyzeQuery(query);

    console.log('Query analysis completed successfully');
    res.json(results);

  } catch (error: any) {
    console.error('Query analysis error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get document summaries
router.post('/documents/:id/summary', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    console.log('Generating summary for document:', documentId);

    const summary = await legalResearchService.generateSummary(documentId);
    res.json(summary);

  } catch (error: any) {
    console.error('Summary generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all documents
router.get('/documents', async (req, res) => {
  try {
    const documents = await db
      .select()
      .from(legalDocuments)
      .orderBy(desc(legalDocuments.createdAt));

    res.json(documents);
  } catch (error: any) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get document versions
router.get('/documents/:id/versions', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const versions = await db
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.id, documentId))
      .orderBy(desc(legalDocuments.createdAt));

    res.json(versions);
  } catch (error: any) {
    console.error('Error fetching document versions:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;