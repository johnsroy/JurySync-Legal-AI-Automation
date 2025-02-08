import { Router } from 'express';
import { legalResearchService } from '../services/legalResearchService';
import type { InsertLegalDocument } from '@shared/schema';
import multer from 'multer';
import { z } from 'zod';
import mammoth from 'mammoth';
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
}).single('filepond'); // For FilePond uploads

// Validation schema for document upload
const documentUploadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  documentType: z.string().min(1, "Document type is required"),
  jurisdiction: z.string().min(1, "Jurisdiction is required"),
  date: z.string().transform(str => new Date(str))
});

// Custom PDF text extraction function
async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  // Basic PDF structure markers
  const startMarker = Buffer.from('%PDF-');
  const endMarker = Buffer.from('%%EOF');

  if (buffer.indexOf(startMarker) !== 0) {
    throw new Error('Invalid PDF format');
  }

  // Convert buffer to string and extract text between PDF markers
  const text = buffer.toString('utf-8');
  const textContent = text
    .split(/[\r\n]/)
    .filter(line => line.trim() && !line.startsWith('%'))
    .join(' ');

  return textContent || 'No text could be extracted';
}

// Helper function to extract text from various document types
async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  const fileType = file.mimetype;
  let extractedText = '';

  try {
    console.log('Extracting text from file:', { fileType, filename: file.originalname });

    if (fileType === 'application/pdf') {
      extractedText = await extractTextFromBuffer(file.buffer);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        fileType === 'application/msword') {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      extractedText = result.value;
    } else {
      // Fallback to treating as plain text
      extractedText = file.buffer.toString('utf-8');
    }

    return extractedText || 'No text could be extracted from the document';
  } catch (error: any) {
    console.error('Error extracting text from file:', error);
    throw new Error(`Failed to extract text from ${file.originalname}: ${error.message}`);
  }
}

// Upload and process legal document
router.post('/documents', async (req, res) => {
  try {
    console.log('Received document upload request');

    await new Promise((resolve, reject) => {
      upload(req, res, (err) => {
        if (err) {
          console.error('Multer upload error:', err);
          reject(err);
        } else {
          resolve(undefined);
        }
      });
    });

    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File received:', {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // For FilePond, we need to send a simple response for the initial upload
    if (!req.body.title) {
      return res.sendStatus(200);
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
    await legalResearchService.addDocument(document);

    // Return success response with document details
    res.json({ 
      success: true, 
      message: 'Document added successfully'
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
      .where(eq(legalDocuments.id, documentId))
      .orderBy(desc(legalDocuments.createdAt));

    res.json(versions);
  } catch (error: any) {
    console.error('Error fetching document versions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add document analysis endpoint
router.post('/documents/:id/analyze', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);

    // Get the document
    const [document] = await db
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.id, documentId));

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Analyze the document using the legal research service
    const results = await legalResearchService.analyzeQuery(document.content);
    res.json(results);

  } catch (error: any) {
    console.error('Document analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add endpoint to fetch all documents
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

export default router;