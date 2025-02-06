import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeDocument, chatWithDocument } from "./openai";
import { insertDocumentSchema, UserRole, ApprovalStatus, SignatureStatus } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import pdf from "pdf-parse/lib/pdf-parse.js";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { openai } from "./openai"; //Import openai for new endpoints
import { Document, Packer } from "docx";
import pdfkit from "pdfkit";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

interface ExtractedContent {
  text: string;
  sections: {
    title: string;
    content: string;
    level: number;
  }[];
  metadata: {
    title?: string;
    author?: string;
    creationDate?: string;
    lastModified?: string;
  };
}

async function extractTextFromFile(file: Express.Multer.File): Promise<ExtractedContent> {
  try {
    switch (file.mimetype) {
      case 'application/pdf': {
        const pdfData = await pdf(file.buffer);
        const sections = [];
        let currentSection = { title: '', content: '', level: 1 };

        // Enhanced PDF parsing logic for better structure detection
        const lines = pdfData.text.split('\n');
        let inHeader = true;
        let headerText = '';

        for (const line of lines) {
          // Detect headers based on various patterns common in legal documents
          const isHeader = (
            line.match(/^[A-Z\d]+[\.\)]\s+[A-Z]/) ||  // "1. SECTION" or "A) SECTION"
            line.match(/^[A-Z][A-Z\s]{4,}/) ||        // "SECTION TITLE"
            line.match(/^Article\s+\d+/i) ||           // "Article 1"
            line.match(/^Section\s+\d+/i)              // "Section 1"
          );

          if (isHeader) {
            // Save previous section if exists
            if (currentSection.content.trim()) {
              sections.push(currentSection);
            }
            currentSection = {
              title: line.trim(),
              content: '',
              level: line.search(/\S/) / 2, // Indentation level
            };
            inHeader = true;
            headerText = line;
          } else {
            if (inHeader && line.trim()) {
              // This line is part of the header
              headerText += ' ' + line.trim();
            } else if (line.trim()) {
              // Regular content
              inHeader = false;
              currentSection.content += line + '\n';
            }
          }
        }

        // Add the last section
        if (currentSection.content.trim()) {
          sections.push(currentSection);
        }

        return {
          text: pdfData.text,
          sections,
          metadata: {
            title: pdfData.info?.Title,
            author: pdfData.info?.Author,
            creationDate: pdfData.info?.CreationDate,
            lastModified: pdfData.info?.ModDate,
          }
        };
      }

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword': {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        const sections = [];
        let currentSection = { title: '', content: '', level: 1 };

        const lines = result.value.split('\n');
        for (const line of lines) {
          if (line.match(/^[A-Z\d]+[\.\)]\s+[A-Z]/)) {
            if (currentSection.content) {
              sections.push(currentSection);
            }
            currentSection = {
              title: line.trim(),
              content: '',
              level: 1
            };
          } else {
            currentSection.content += line + '\n';
          }
        }
        if (currentSection.content) {
          sections.push(currentSection);
        }

        return {
          text: result.value,
          sections,
          metadata: {}
        };
      }

      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel': {
        const workbook = XLSX.read(file.buffer);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const text = XLSX.utils.sheet_to_txt(worksheet);

        const sections = text.split('\n')
          .filter(line => line.trim())
          .map(line => ({
            title: line.split('\t')[0] || 'Untitled Section',
            content: line,
            level: 1
          }));

        return {
          text,
          sections,
          metadata: {
            title: workbook.Props?.Title,
            author: workbook.Props?.Author,
            lastModified: workbook.Props?.ModifiedDate?.toString(),
          }
        };
      }

      default:
        throw new Error('Unsupported file type');
    }
  } catch (error) {
    console.error('Error extracting text:', error);
    throw error;
  }
}

function requireRole(role: UserRole) {
  return (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Authentication required",
        code: "NOT_AUTHENTICATED"
      });
    }

    if (req.user.role !== role && req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Insufficient permissions",
        code: "FORBIDDEN"
      });
    }

    next();
  };
}


export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Add new middleware for role-based access control
  const db = { select: () => ({ from: () => ({ where: () => ({}) }) }) }; // Placeholder
  const approvals = { documentId: '', status: '' }; //Placeholder
  const signatures = { documentId: '', signatureData: { token: '' }, status: '', expiresAt: '' }; //Placeholder
  const and = () => ({}); // Placeholder
  const eq = () => ({}); // Placeholder

  function sendEmail(options: any) {
    console.log("Sending email:", options); // Placeholder
    return Promise.resolve();
  }


  app.post("/api/documents", upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "You must be logged in to create documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          message: "No file uploaded",
          code: "FILE_REQUIRED"
        });
      }

      let extractedContent: ExtractedContent;
      try {
        extractedContent = await extractTextFromFile(req.file);
        if (!extractedContent.text || extractedContent.text.trim().length === 0) {
          throw new Error("Empty document content");
        }
      } catch (error) {
        console.error('Text extraction error:', error);
        return res.status(400).json({
          message: "Failed to extract text from document. Please ensure the file is not corrupted or empty.",
          code: "EXTRACTION_ERROR"
        });
      }

      const document = {
        title: req.body.title || extractedContent.metadata.title || req.file.originalname,
        content: extractedContent.text,
        agentType: req.body.agentType || "CONTRACT_AUTOMATION",
      };

      let parsed;
      try {
        parsed = insertDocumentSchema.parse(document);
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({
            message: fromZodError(error).message,
            code: "VALIDATION_ERROR"
          });
        }
        throw error;
      }

      let analysis;
      try {
        console.log("Processing document with agent:", parsed.agentType);
        // Pass the structured content to the analysis
        analysis = await analyzeDocument(
          extractedContent.text,
          parsed.agentType,
          extractedContent.sections
        );
      } catch (error) {
        console.error('Analysis error:', error);
        return res.status(503).json({
          message: "Our AI system is currently experiencing high load. Please try again in a few moments.",
          code: "ANALYSIS_ERROR"
        });
      }

      try {
        const createdDocument = await storage.createDocument({
          ...parsed,
          content: extractedContent.text,
          userId: req.user!.id,
          analysis,
          metadata: extractedContent.metadata
        });

        res.status(201).json(createdDocument);
      } catch (error) {
        console.error('Storage error:', error);
        return res.status(500).json({
          message: "Failed to save document",
          code: "STORAGE_ERROR"
        });
      }

    } catch (error) {
      console.error('Document creation error:', error);

      if (error instanceof Error && error.message === 'Invalid file type') {
        return res.status(400).json({
          message: "Invalid file type. Please upload PDF, DOCX, DOC, or XLSX files only.",
          code: "FILE_TYPE_ERROR"
        });
      }

      res.status(500).json({
        message: "An unexpected error occurred while processing your document",
        code: "UNKNOWN_ERROR"
      });
    }
  });

  app.get("/api/documents", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "You must be logged in to access documents",
        code: "NOT_AUTHENTICATED"
      });
    }
    try {
      const documents = await storage.getDocuments(req.user!.id);
      res.json(documents);
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({
        message: "Failed to fetch documents",
        code: "FETCH_ERROR"
      });
    }
  });

  app.get("/api/documents/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "You must be logged in to access documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({
          message: "Invalid document ID",
          code: "INVALID_ID"
        });
      }

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({
          message: "Document not found",
          code: "NOT_FOUND"
        });
      }

      if (document.userId !== req.user!.id) {
        return res.status(403).json({
          message: "You don't have permission to access this document",
          code: "FORBIDDEN"
        });
      }

      res.json(document);
    } catch (error) {
      console.error('Error fetching document:', error);
      res.status(500).json({
        message: "Failed to fetch document",
        code: "FETCH_ERROR"
      });
    }
  });

  app.post("/api/documents/:id/chat", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "You must be logged in to access documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({
          message: "Invalid document ID",
          code: "INVALID_ID"
        });
      }

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({
          message: "Document not found",
          code: "NOT_FOUND"
        });
      }

      if (document.userId !== req.user!.id) {
        return res.status(403).json({
          message: "You don't have permission to access this document",
          code: "FORBIDDEN"
        });
      }

      const { message, context } = req.body;
      const response = await chatWithDocument(message, context, document.analysis);
      res.json({ response });

    } catch (error) {
      console.error('Error in chat endpoint:', error);
      res.status(500).json({
        message: "Failed to process chat request",
        code: "CHAT_ERROR"
      });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "You must be logged in to delete documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({
          message: "Invalid document ID",
          code: "INVALID_ID"
        });
      }

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({
          message: "Document not found",
          code: "NOT_FOUND"
        });
      }

      if (document.userId !== req.user!.id) {
        return res.status(403).json({
          message: "You don't have permission to delete this document",
          code: "FORBIDDEN"
        });
      }

      await storage.deleteDocument(documentId);
      res.sendStatus(204);
    } catch (error) {
      console.error('Error deleting document:', error);
      res.status(500).json({
        message: "Failed to delete document",
        code: "DELETE_ERROR"
      });
    }
  });

  // Generate contract draft
  app.post("/api/documents/:id/generate-draft", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "You must be logged in to access documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({
          message: "Invalid document ID",
          code: "INVALID_ID"
        });
      }

      const document = await storage.getDocument(documentId);
      if (!document || document.userId !== req.user!.id) {
        return res.status(403).json({
          message: "Access denied",
          code: "FORBIDDEN"
        });
      }

      const requirements = req.body.requirements;
      if (!requirements || requirements.trim().length === 0) {
        return res.status(400).json({
          message: "Requirements cannot be empty",
          code: "INVALID_INPUT"
        });
      }

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo-16k",
          messages: [
            {
              role: "system",
              content: `You are an expert legal contract drafting assistant. Generate a clear, concise, and professional contract that includes:
1. Clear section numbering and structure
2. Professional legal language and terminology
3. Standard clauses and terms
4. Key provisions based on requirements
Ensure the output is properly formatted and ready for immediate use.`
            },
            {
              role: "user",
              content: requirements
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        });

        const draftContent = response.choices[0].message.content;
        if (!draftContent) {
          throw new Error("Empty response from OpenAI");
        }

        // Update existing document with generated draft
        await storage.updateDocument(documentId, {
          content: draftContent,
          analysis: {
            ...document.analysis as any,
            contractDetails: {
              ...(document.analysis as any)?.contractDetails,
              versionControl: {
                version: "1.0",
                changes: [{
                  timestamp: new Date().toISOString(),
                  user: req.user!.username,
                  description: "Initial draft generated"
                }],
                previousVersions: []
              }
            }
          }
        });

        res.json({ content: draftContent });

      } catch (error: any) {
        console.error('OpenAI API error:', error);
        if (error.response?.status === 429) {
          return res.status(429).json({
            message: "Rate limit reached. Please try again in a moment.",
            code: "RATE_LIMIT"
          });
        }
        if (error.response?.status === 400) {
          return res.status(400).json({
            message: "The requirements are too long. Please shorten them.",
            code: "CONTENT_TOO_LONG"
          });
        }
        throw error;
      }

    } catch (error: any) {
      console.error('Error generating draft:', error);
      res.status(500).json({
        message: error.message || "Failed to generate draft. Please try again.",
        code: "UNKNOWN_ERROR"
      });
    }
  });

  app.get("/api/documents/:id/download", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "You must be logged in to access documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);
      const format = req.query.format || 'docx'; // Default to docx

      if (!document || document.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Allow download if draft is generated
      if (!document.content) {
        return res.status(400).json({
          message: "No draft content available for download",
          code: "NO_CONTENT"
        });
      }

      const fileName = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

      if (format === 'pdf') {
        const pdf = new pdfkit();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);

        pdf.pipe(res);
        pdf.fontSize(16).text(document.title, { align: 'center' });
        pdf.moveDown();
        pdf.fontSize(12).text(document.content);
        pdf.end();

      } else if (format === 'docx') {
        const doc = new Document({
          sections: [{
            properties: {},
            children: [
              {
                text: document.title,
                heading: true,
                bold: true
              },
              {
                text: document.content
              }
            ]
          }]
        });

        const buffer = await Packer.toBuffer(doc);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}.docx"`);
        res.send(buffer);

      } else {
        // Fallback to plain text
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}.txt"`);
        res.send(document.content);
      }

    } catch (error) {
      console.error('Error downloading document:', error);
      res.status(500).json({
        message: "Failed to download document",
        code: "DOWNLOAD_ERROR"
      });
    }
  });

  app.post("/api/documents/:id/analyze-clause", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "You must be logged in to access documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);
      if (!document || document.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const clause = req.body.clause;
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a legal contract analysis assistant. Analyze the provided clause for potential risks and suggest improvements."
          },
          {
            role: "user",
            content: clause
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      const analysis = {
        suggestion: response.choices[0].message.content,
        riskLevel: Math.floor(Math.random() * 10) + 1, // This should be replaced with actual risk assessment logic
        timestamp: new Date().toISOString()
      };

      // Update document with analysis
      const updatedAnalysis = {
        ...document.analysis,
        contractDetails: {
          ...document.analysis.contractDetails,
          redlineHistory: [
            ...(document.analysis.contractDetails?.redlineHistory || []),
            {
              clause,
              ...analysis
            }
          ]
        }
      };

      await storage.createDocument({
        ...document,
        analysis: updatedAnalysis
      });

      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing clause:', error);
      res.status(500).json({
        message: "Failed to analyze clause",
        code: "ANALYSIS_ERROR"
      });
    }
  });

  // Update the workflow endpoint to handle content updates
  app.post("/api/documents/:id/workflow", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "You must be logged in to access documents",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);
      if (!document || document.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { action, content } = req.body;
      let newStatus;
      switch (action) {
        case "review":
          newStatus = "REVIEW";
          break;
        case "approve":
          newStatus = "APPROVAL";
          break;
        case "sign":
          newStatus = "SIGNATURE";
          break;
        default:
          return res.status(400).json({ message: "Invalid action" });
      }

      // If content is provided, update the document content
      const updatedDocument = await storage.createDocument({
        ...document,
        content: content || document.content,
        analysis: {
          ...document.analysis,
          contractDetails: {
            ...document.analysis.contractDetails,
            workflowState: {
              ...document.analysis.contractDetails?.workflowState,
              status: newStatus,
              comments: [
                ...(document.analysis.contractDetails?.workflowState?.comments || []),
                {
                  user: req.user!.username,
                  text: content ? "Document updated and sent for review" : `Document sent for ${action}`,
                  timestamp: new Date().toISOString()
                }
              ]
            }
          }
        }
      });

      res.json(updatedDocument);
    } catch (error) {
      console.error('Error updating workflow:', error);
      res.status(500).json({
        message: "Failed to update workflow",
        code: "WORKFLOW_ERROR"
      });
    }
  });

  app.post("/api/documents/:id/request-review", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Authentication required",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);

      if (!document || document.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { approverId } = req.body;
      const approver = await storage.getUser(approverId);

      if (!approver || approver.role !== "ADMIN") {
        return res.status(400).json({
          message: "Invalid approver selected",
          code: "INVALID_APPROVER"
        });
      }

      // Create approval request
      const approval = await storage.createApproval({
        documentId,
        requesterId: req.user!.id,
        approverId,
        status: "PENDING",
        comments: req.body.comments
      });

      // Create new version
      await storage.createVersion({
        documentId,
        version: "1.0",
        content: document.content,
        changes: [],
        authorId: req.user!.id
      });

      // Update document status
      await storage.updateDocument(documentId, {
        analysis: {
          ...document.analysis,
          contractDetails: {
            ...document.analysis.contractDetails,
            workflowState: {
              ...document.analysis.contractDetails?.workflowState,
              status: "REVIEW",
              currentReviewer: approver.username
            }
          }
        }
      });

      // Send email notification
      if (approver.email) {
        await sendEmail({
          to: approver.email,
          from: "noreply@legalai.com",
          subject: "Document Review Request",
          text: `You have a new document review request from ${req.user!.username}`,
          html: `<p>You have a new document review request from ${req.user!.username}</p>`
        });
      }

      res.json(approval);
    } catch (error) {
      console.error('Error requesting review:', error);
      res.status(500).json({
        message: "Failed to request review",
        code: "REVIEW_REQUEST_ERROR"
      });
    }
  });

  app.post("/api/documents/:id/approve", requireRole("ADMIN"), async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);

      if (!document) {
        return res.status(404).json({
          message: "Document not found",
          code: "NOT_FOUND"
        });
      }

      // Update approval status
      const [approval] = await db
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.documentId, documentId),
            eq(approvals.status, "PENDING")
          )
        );

      if (approval) {
        await storage.updateApproval(approval.id, "APPROVED", req.body.comments);
      }

      // Update document status
      await storage.updateDocument(documentId, {
        analysis: {
          ...document.analysis,
          contractDetails: {
            ...document.analysis.contractDetails,
            workflowState: {
              ...document.analysis.contractDetails?.workflowState,
              status: "APPROVAL"
            }
          }
        }
      });

      res.json({ message: "Document approved successfully" });
    } catch (error) {
      console.error('Error approving document:', error);
      res.status(500).json({
        message: "Failed to approve document",
        code: "APPROVAL_ERROR"
      });
    }
  });

  app.post("/api/documents/:id/request-signature", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Authentication required",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);

      if (!document || document.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { signerEmails } = req.body;

      // Create signature requests
      const signaturePromises = signerEmails.map(async (email: string) => {
        const user = await storage.getUserByEmail(email);
        if (!user) {
          throw new Error(`User not found for email: ${email}`);
        }

        // Generate unique signature link
        const signatureToken = createHash('sha256')
          .update(`${documentId}-${user.id}-${Date.now()}`)
          .digest('hex');

        return storage.createSignature({
          documentId,
          userId: user.id,
          status: "PENDING",
          signatureData: {
            token: signatureToken,
            email: email
          },
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });
      });

      const signatures = await Promise.all(signaturePromises);

      // Update document status
      await storage.updateDocument(documentId, {
        analysis: {
          ...document.analysis,
          contractDetails: {
            ...document.analysis.contractDetails,
            workflowState: {
              ...document.analysis.contractDetails?.workflowState,
              status: "SIGNATURE",
              signatureStatus: {
                required: signerEmails,
                completed: []
              }
            }
          }
        }
      });

      // Send email notifications
      const emailPromises = signatures.map(signature =>
        sendEmail({
          to: signature.signatureData.email,
          from: "noreply@legalai.com",
          subject: "Document Signature Request",
          text: `You have a new document to sign. Click here to view and sign: ${process.env.APP_URL}/sign/${signature.signatureData.token}`,
          html: `<p>You have a new document to sign. <a href="${process.env.APP_URL}/sign/${signature.signatureData.token}">Click here</a> to view and sign.</p>`
        })
      );

      await Promise.all(emailPromises);

      res.json({ signatures });
    } catch (error) {
      console.error('Error requesting signatures:', error);
      res.status(500).json({
        message: "Failed to request signatures",
        code: "SIGNATURE_REQUEST_ERROR"
      });
    }
  });

  // Add route for signing documents
  app.post("/api/documents/sign/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { signatureData } = req.body;

      // Find signature request
      const [signature] = await db
        .select()
        .from(signatures)
        .where(eq(signatures.signatureData.token, token));

      if (!signature) {
        return res.status(404).json({
          message: "Signature request not found",
          code: "NOT_FOUND"
        });
      }

      if (signature.status === "COMPLETED") {
        return res.status(400).json({
          message: "Document already signed",
          code: "ALREADY_SIGNED"
        });
      }

      if (new Date() > new Date(signature.expiresAt)) {
        return res.status(400).json({
          message: "Signature request expired",
          code: "EXPIRED"
        });
      }

      // Update signature
      await storage.updateSignature(signature.id, "COMPLETED", signatureData);

      // Update document if all signatures are completed
      const document = await storage.getDocument(signature.documentId);
      const allSignatures = await db
        .select()
        .from(signatures)
        .where(eq(signatures.documentId, signature.documentId));

      const allSigned = allSignatures.every(s => s.status === "COMPLETED");

      if (allSigned) {
        await storage.updateDocument(signature.documentId, {
          analysis: {
            ...document.analysis,
            contractDetails: {
              ...document.analysis.contractDetails,
              workflowState: {
                ...document.analysis.contractDetails?.workflowState,
                status: "COMPLETED"
              }
            }
          }
        });
      }

      res.json({ message: "Document signed successfully" });
    } catch (error) {
      console.error('Error signing document:', error);
      res.status(500).json({
        message: "Failed to sign document",
        code: "SIGNATURE_ERROR"
      });
    }
  });

  // Add route for getting document versions
  app.get("/api/documents/:id/versions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Authentication required",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);

      if (!document || (document.userId !== req.user!.id && req.user!.role !== "ADMIN")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const versions = await storage.getVersions(documentId);
      res.json(versions);
    } catch (error) {
      console.error('Error fetching versions:', error);
      res.status(500).json({
        message: "Failed to fetch versions",
        code: "VERSION_FETCH_ERROR"
      });
    }
  });

  // Add this route after the existing routes
  app.get("/api/users/admins", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Authentication required",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const admins = await storage.getUsersByRole("ADMIN");
      res.json(admins);
    } catch (error) {
      console.error('Error fetching admins:', error);
      res.status(500).json({
        message: "Failed to fetch admin users",
        code: "FETCH_ERROR"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}