import { Router } from 'express';
import { legalResearchService } from '../services/legalResearchService';
import type { InsertLegalDocument } from '@shared/schema';
import multer from 'multer';
import { z } from 'zod';
import mammoth from 'mammoth';
import { PDFDocument } from 'pdf-lib';
import { db } from '../db';
import { legalDocuments } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

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

// Helper function to extract text from various document types
async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  const fileType = file.mimetype;

  if (fileType === 'application/pdf') {
    const pdfDoc = await PDFDocument.load(file.buffer);
    return pdfDoc.getPages().map(page => page.getText()).join('\n');
  } 

  if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      fileType === 'application/msword') {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  }

  // Fallback to treating as plain text
  return file.buffer.toString('utf-8');
}

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

    // Extract text content from the uploaded file
    const content = await extractTextFromFile(req.file);

    // Create new document version
    const document: InsertLegalDocument = {
      title: validatedData.title,
      content,
      documentType: validatedData.documentType,
      jurisdiction: validatedData.jurisdiction,
      date: validatedData.date,
      status: 'ACTIVE',
      metadata: {
        filename: req.file.originalname,
        fileType: req.file.mimetype,
        uploadDate: new Date().toISOString()
      },
      citations: []
    };

    // Add document to vector store and database
    const result = await legalResearchService.addDocument(document);

    // Return success response with document details
    res.json({ 
      success: true, 
      message: 'Document added successfully',
      document: {
        id: result.id,
        title: result.title,
        documentType: result.documentType
      }
    });

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

// Get document versions
router.get('/documents/:id/versions', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const versions = await db
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.parentDocumentId, documentId))
      .orderBy(desc(legalDocuments.createdAt));

    res.json(versions);
  } catch (error: any) {
    console.error('Error fetching document versions:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;