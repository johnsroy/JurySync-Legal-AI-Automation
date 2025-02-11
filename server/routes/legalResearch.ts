import { Router, Request, Response, NextFunction } from 'express';
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

// Error handler middleware with proper typing
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error('Route error:', error);
      // Ensure we always return JSON, even for errors
      res.status(500).json({ 
        error: error.message || 'Internal server error',
        status: 'error'
      });
    });
  };

// Query validation schema
const querySchema = z.object({
  query: z.string().min(1, "Query is required")
});

// Upload document
router.post('/documents', (req: Request, res: Response) => {
  upload(req, res, async (err: any) => {
    try {
      if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({ 
          error: err.message,
          status: 'error'
        });
      }

      if (!req.file) {
        return res.status(400).json({ 
          error: 'No file uploaded',
          status: 'error'
        });
      }

      // Extract text content based on file type
      let content = '';
      if (req.file.mimetype === 'text/plain') {
        content = req.file.buffer.toString('utf-8');
      } else if (req.file.mimetype.includes('wordprocessingml')) {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        content = result.value;
      } else {
        content = req.file.buffer.toString('utf-8');
      }

      const document = {
        title: req.file.originalname,
        content,
        documentType: 'UPLOADED',
        jurisdiction: 'Unknown',
        date: new Date(),
        status: 'ACTIVE',
        metadata: {
          fileType: req.file.mimetype,
          fileSize: req.file.size
        },
        citations: [],
        vectorId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const [insertedDoc] = await db
        .insert(legalDocuments)
        .values(document)
        .returning();

      await legalResearchService.addDocument(insertedDoc);

      res.json({
        documentId: insertedDoc.id,
        title: insertedDoc.title,
        content: insertedDoc.content,
        status: 'success'
      });

    } catch (error: any) {
      console.error('Document upload error:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to process document',
        status: 'error'
      });
    }
  });
});

// Get all documents
router.get('/documents', asyncHandler(async (req: Request, res: Response) => {
  await legalResearchService.initialize();
  const documents = await db
    .select()
    .from(legalDocuments)
    .orderBy(desc(legalDocuments.createdAt));
  res.json({
    documents,
    status: 'success'
  });
}));

// Analyze document
router.post('/documents/:id/analyze', asyncHandler(async (req: Request, res: Response) => {
  const documentId = parseInt(req.params.id);
  if (isNaN(documentId)) {
    return res.status(400).json({ 
      error: 'Invalid document ID',
      status: 'error'
    });
  }

  const analysis = await legalResearchService.analyzeDocument(documentId);
  res.json({
    ...analysis,
    status: 'success'
  });
}));

// Get document summary
router.post('/documents/:id/summary', asyncHandler(async (req: Request, res: Response) => {
  const documentId = parseInt(req.params.id);
  if (isNaN(documentId)) {
    return res.status(400).json({ 
      error: 'Invalid document ID',
      status: 'error'
    });
  }

  const summary = await legalResearchService.generateSummary(documentId);
  res.json({
    ...summary,
    status: 'success'
  });
}));

// Search documents
router.post('/query', asyncHandler(async (req: Request, res: Response) => {
  const { query } = querySchema.parse(req.body);
  const results = await legalResearchService.analyzeQuery(query);
  res.json({
    ...results,
    status: 'success'
  });
}));

export default router;