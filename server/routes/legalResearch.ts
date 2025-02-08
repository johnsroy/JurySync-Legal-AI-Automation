import { Router } from 'express';
import { legalResearchService } from '../services/legalResearchService';
import type { InsertLegalDocument } from '@shared/schema';
import multer from 'multer';
import { z } from 'zod';
import mammoth from 'mammoth';
import { db } from '../db';
import { legalDocuments } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { Anthropic } from '@anthropic-ai/sdk';

// Initialize Anthropic client
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
  try {
    console.log('Starting PDF text extraction...');

    // Convert buffer to string and extract text
    const text = buffer.toString('utf-8');

    // Look for text content markers in PDF
    const contentStart = text.indexOf('stream');
    const contentEnd = text.lastIndexOf('endstream');

    if (contentStart === -1 || contentEnd === -1) {
      console.log('No stream markers found, returning full content');
      return text;
    }

    // Extract text between markers and clean it
    const textContent = text
      .substring(contentStart + 6, contentEnd)
      .split(/[\r\n]/)
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('%') && !/^\d+$/.test(trimmed);
      })
      .join(' ')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\/g, '');

    console.log('Text extraction completed successfully');
    return textContent || 'No text could be extracted';
  } catch (error) {
    console.error('Error in PDF text extraction:', error);
    throw error;
  }
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

const router = Router();

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
    const document = {
      title: validatedData.title,
      content,
      documentType: validatedData.documentType,
      jurisdiction: validatedData.jurisdiction,
      date: validatedData.date,
      status: 'ACTIVE' as const,
      metadata: {
        filename: req.file.originalname,
        fileType: req.file.mimetype,
        uploadDate: new Date().toISOString()
      },
      citations: []
    };

    // Add document to database first
    const [createdDoc] = await db
      .insert(legalDocuments)
      .values(document)
      .returning();

    // Then add to vector store
    await legalResearchService.addDocument(createdDoc);

    // Return success response with document ID
    res.json({
      success: true,
      message: 'Document added successfully',
      documentId: createdDoc.id
    });

  } catch (error: any) {
    console.error('Document upload error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
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

    console.log('Analyzing document:', { id: documentId, title: document.title });

    // Use Anthropic to analyze the document
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      temperature: 0.2,
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this legal document comprehensively and provide a structured analysis. Include key findings, legal implications, and related precedents if applicable.

Document Title: ${document.title}
Content: ${document.content}

Structure your response as a JSON object with these fields:
{
  "summary": "A concise summary of the document",
  "keyPoints": ["Array of main points"],
  "legalImplications": ["Array of legal implications"],
  "recommendations": ["Array of recommendations or next steps"],
  "riskAreas": ["Array of potential risk areas identified"]
}`
          }
        ]
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format from Anthropic API');
    }

    const analysis = JSON.parse(content.text);
    console.log('Analysis completed');

    res.json(analysis);

  } catch (error: any) {
    console.error('Document analysis error:', error);
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