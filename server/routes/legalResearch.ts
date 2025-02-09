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
import { default as pdfParseLib } from 'pdf-parse';
import { analyzePDFContent } from '../services/fileAnalyzer';

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
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
      return;
    }
    cb(null, true);
  }
}).single('filepond');

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
          return;
        }
        resolve(undefined);
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

    try {
      // Use fileAnalyzer service to extract and process content
      const content = await analyzePDFContent(req.file.buffer, -1); // Use -1 to skip DB update

      // Create new document in database
      const [document] = await db
        .insert(legalDocuments)
        .values({
          title: req.file.originalname,
          content: content,
          status: "UPLOADED",
          createdAt: new Date().toISOString(),
          metadata: {
            fileType: req.file.mimetype,
            fileName: req.file.originalname,
            fileSize: req.file.size
          }
        })
        .returning();

      console.log('Document processed successfully:', document.id);

      // Return document data for FilePond
      res.json({
        documentId: document.id,
        title: document.title,
        content: document.content,
        status: document.status,
        date: document.createdAt
      });

    } catch (error: any) {
      console.error('Document processing error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      throw error;
    }

  } catch (error: any) {
    console.error('Document upload error:', error);
    res.status(500).json({
      error: error.message,
      details: error.toString()
    });
  }
});

// Add document analysis endpoint
router.post('/documents/:id/analyze', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    console.log('Starting document analysis for ID:', documentId);

    // Get the document
    const [document] = await db
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.id, documentId));

    if (!document) {
      console.error('Document not found:', documentId);
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

    console.log('Received Anthropic response, parsing JSON...');
    const analysis = JSON.parse(content.text);
    console.log('Analysis completed successfully:', {
      summaryLength: analysis.summary?.length,
      numKeyPoints: analysis.keyPoints?.length,
      numImplications: analysis.legalImplications?.length
    });

    res.json(analysis);

  } catch (error: any) {
    console.error('Document analysis error:', error);
    res.status(500).json({
      error: error.message,
      details: error.toString()
    });
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