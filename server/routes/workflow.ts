import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { vaultDocuments, metricsEvents, documentAnalysis } from "@shared/schema";
import { analyzeDocument } from "../services/documentAnalysisService";
import { processDocument } from "../services/documentProcessor";
import { createVectorEmbedding } from "../services/vectorService";

// Configure multer with memory storage and strict file filtering
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    console.log('Multer processing file:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      timestamp: new Date().toISOString()
    });

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      console.log('File type rejection:', {
        mimetype: file.mimetype,
        allowed: allowedTypes,
        timestamp: new Date().toISOString()
      });
      cb(new Error(`Invalid file type. Only PDF, DOC, DOCX and TXT files are allowed. Got: ${file.mimetype}`));
      return;
    }

    // Additional validation for file name and extension
    const fileName = file.originalname.toLowerCase();
    const validExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    if (!validExtensions.some(ext => fileName.endsWith(ext))) {
      console.log('File extension rejection:', {
        filename: fileName,
        valid: validExtensions,
        timestamp: new Date().toISOString()
      });
      cb(new Error('Invalid file extension'));
      return;
    }

    cb(null, true);
  }
});

const router = Router();

router.post("/upload", upload.single("file"), async (req, res) => {
  const startTime = Date.now();

  console.log("Processing upload request:", {
    filename: req.file?.originalname,
    size: req.file?.size,
    type: req.file?.mimetype,
    headers: req.headers['content-type'],
    timestamp: new Date().toISOString()
  });

  try {
    // Validate file presence
    if (!req.file) {
      console.log('No file in request:', {
        body: req.body,
        headers: req.headers,
        timestamp: new Date().toISOString()
      });
      return res.status(400).json({ 
        error: "No file uploaded",
        timestamp: new Date().toISOString()
      });
    }

    console.log('File received, starting processing:', {
      filename: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
      timestamp: new Date().toISOString()
    });

    // Process document content with enhanced extraction
    const processResult = await processDocument(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    console.log('Document processing result:', {
      success: processResult.success,
      contentLength: processResult.content?.length,
      error: processResult.error,
      timestamp: new Date().toISOString()
    });

    if (!processResult.success || !processResult.content) {
      return res.status(400).json({
        error: "Failed to process document",
        details: processResult.error,
        timestamp: new Date().toISOString()
      });
    }

    // Generate vector embedding for similarity search
    console.log('Generating vector embedding...');
    const vectorEmbedding = await createVectorEmbedding(processResult.content);

    // Get AI insights
    console.log('Running AI analysis...');
    const analysis = await analyzeDocument(processResult.content);

    console.log('Storing document in database...');
    // Store document in vault with transaction
    const [document] = await db.transaction(async (tx) => {
      // Insert document
      const [doc] = await tx
        .insert(vaultDocuments)
        .values({
          userId: req.session?.userId || 1, // Temporary fix for demo
          title: req.file!.originalname,
          content: processResult.content,
          documentType: analysis.documentType || 'OTHER',
          fileSize: req.file!.size,
          mimeType: req.file!.mimetype,
          aiSummary: analysis.summary,
          aiClassification: analysis.classification,
          vectorId: vectorEmbedding.id,
          metadata: {
            ...processResult.metadata,
            keywords: analysis.keywords,
            confidence: analysis.confidence,
            entities: analysis.entities,
            processingDetails: {
              method: processResult.metadata?.method,
              pageCount: processResult.metadata?.pageCount,
              processingTime: processResult.metadata?.processingTime
            }
          }
        })
        .returning();

      // Store analysis results
      await tx.insert(documentAnalysis).values({
        documentId: doc.id,
        documentType: doc.documentType,
        industry: analysis.industry || 'UNKNOWN',
        complianceStatus: analysis.complianceStatus,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Track metrics
      await tx.insert(metricsEvents).values({
        userId: req.session?.userId || 1,
        modelId: 'document-analysis',
        taskType: 'DOCUMENT_UPLOAD',
        processingTimeMs: Date.now() - startTime,
        successful: true,
        metadata: {
          documentId: doc.id,
          documentType: doc.documentType,
          processingMethod: processResult.metadata?.method,
          fileSize: req.file!.size,
          aiModelUsed: 'enhanced-extraction'
        }
      });

      return [doc];
    });

    console.log('Upload processing completed successfully:', {
      documentId: document.id,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });

    // Return success response with detailed metadata
    res.json({
      status: 'success',
      documentId: document.id,
      text: processResult.content,
      metadata: {
        ...processResult.metadata,
        extractionQuality: analysis.confidence,
        processingTime: Date.now() - startTime
      },
      analysis: {
        ...analysis,
        vectorId: vectorEmbedding.id
      }
    });

  } catch (error) {
    console.error("Error processing document:", error);

    // Track error metrics
    if (req.session?.userId) {
      await db.insert(metricsEvents).values({
        userId: req.session.userId,
        modelId: 'document-analysis',
        taskType: 'DOCUMENT_UPLOAD',
        processingTimeMs: Date.now() - startTime,
        successful: false,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          filename: req.file?.originalname,
          fileType: req.file?.mimetype
        }
      });
    }

    // Return appropriate error response
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ 
        error: "File upload error",
        details: error.message,
        code: error.code
      });
    }

    if (error instanceof Error && error.message.includes('Invalid file type')) {
      return res.status(400).json({ 
        error: error.message,
        allowedTypes: ['PDF', 'DOC', 'DOCX', 'TXT']
      });
    }

    res.status(500).json({ 
      error: "Failed to process document",
      message: error instanceof Error ? error.message : "An unexpected error occurred during document processing",
      timestamp: new Date().toISOString()
    });
  }
});

export default router;