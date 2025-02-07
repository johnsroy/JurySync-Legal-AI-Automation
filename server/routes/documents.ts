import { Router } from "express";
import { generateContractDraft, analyzeContractClauses, compareVersions } from "../services/openai";
import { db } from "../db";
import { documents, documentVersions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { SignPdf } from 'node-signpdf';
import * as fs from 'fs';

const router = Router();

// Generate contract draft
router.post("/api/documents/generate", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { templateType, requirements, customInstructions } = req.body;

    // Validate request body
    if (!templateType || !requirements) {
      return res.status(400).json({
        error: "Missing required fields",
        code: "VALIDATION_ERROR"
      });
    }

    // Generate draft using OpenAI
    const draft = await generateContractDraft({
      templateType,
      requirements: JSON.parse(requirements),
      customInstructions,
      userId: req.user!.id
    });

    // Create document record
    const [document] = await db.insert(documents)
      .values({
        title: `${templateType} Contract Draft`,
        content: draft,
        userId: req.user!.id,
        agentType: 'CONTRACT_AUTOMATION',
        analysis: {},
        processingStatus: "COMPLETED"
      })
      .returning();

    // Create initial version
    await db.insert(documentVersions)
      .values({
        documentId: document.id,
        version: "1.0",
        content: draft,
        authorId: req.user!.id,
        changes: [{
          description: "Initial contract draft generated",
          timestamp: new Date().toISOString(),
          user: req.user!.username
        }]
      });

    res.json({
      id: document.id,
      content: draft,
      message: "Contract draft generated successfully"
    });

  } catch (error: any) {
    console.error("Generation error:", error);
    res.status(500).json({
      error: error.message,
      code: "GENERATION_ERROR"
    });
  }
});

// Upload and process document
router.post("/api/documents", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        error: "Not authenticated",
        code: "NOT_AUTHENTICATED"
      });
    }

    const { title, content, agentType } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        error: "Missing required fields",
        code: "VALIDATION_ERROR"
      });
    }

    // Create initial document
    const [document] = await db.insert(documents)
      .values({
        title,
        content: Buffer.from(content, 'base64').toString(),
        userId: req.user!.id,
        agentType,
        analysis: {},
        processingStatus: "PENDING"
      })
      .returning();

    // Create initial version
    await db.insert(documentVersions)
      .values({
        documentId: document.id,
        version: "1.0",
        content: Buffer.from(content, 'base64').toString(),
        authorId: req.user!.id,
        changes: [{
          description: "Initial document upload",
          timestamp: new Date().toISOString(),
          user: req.user!.username
        }]
      });

    // Analyze document content
    try {
      const analysis = await analyzeContractClauses(Buffer.from(content, 'base64').toString());

      // Update document with analysis
      await db.update(documents)
        .set({
          analysis,
          processingStatus: "COMPLETED"
        })
        .where(eq(documents.id, document.id));

      res.status(201).json({ ...document, analysis });
    } catch (error: any) {
      console.error("Analysis error:", error);
      // Update document with error status but still return success
      await db.update(documents)
        .set({
          processingStatus: "ERROR",
          errorMessage: error.message
        })
        .where(eq(documents.id, document.id));

      res.status(201).json(document);
    }

  } catch (error: any) {
    console.error("Document upload error:", error);
    res.status(500).json({
      error: error.message,
      code: "INTERNAL_ERROR"
    });
  }
});

// Generate draft based on requirements
router.post("/api/documents/:id/generate-draft", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { requirements } = req.body;
    const documentId = parseInt(req.params.id);

    // Get existing document
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document || document.userId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Generate draft using OpenAI
    const draft = await generateContractDraft({
      requirements: [{
        type: "STANDARD",
        description: requirements,
        importance: "HIGH"
      }]
    });

    // Create new version
    const [newVersion] = await db.insert(documentVersions)
      .values({
        documentId,
        version: (parseFloat(document.currentVersion || "1.0") + 0.1).toFixed(1),
        content: draft,
        authorId: req.user!.id,
        changes: [{
          description: "Generated new draft from requirements",
          timestamp: new Date().toISOString(),
          user: req.user!.username
        }]
      })
      .returning();

    // Update document content
    await db.update(documents)
      .set({
        content: draft,
        analysis: {
          ...document.analysis,
          lastRequirements: requirements,
          generatedAt: new Date().toISOString()
        }
      })
      .where(eq(documents.id, documentId));

    res.json({
      content: draft,
      version: newVersion
    });

  } catch (error: any) {
    console.error("Draft generation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze contract clauses
router.post("/api/documents/:id/analyze", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const documentId = parseInt(req.params.id);
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document || document.userId !== req.user!.id) {
      return res.status(404).json({ error: "Document not found" });
    }

    const analysis = await analyzeContractClauses(document.content);

    // Update document with analysis
    await db.update(documents)
      .set({ analysis })
      .where(eq(documents.id, documentId));

    res.json(analysis);

  } catch (error: any) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Compare versions
router.post("/api/documents/:id/compare-versions", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { originalVersionId, newVersionId } = req.body;
    const documentId = parseInt(req.params.id);

    // Get both versions
    const [originalVersion, newVersion] = await Promise.all([
      db.select().from(documentVersions).where(eq(documentVersions.id, originalVersionId)),
      db.select().from(documentVersions).where(eq(documentVersions.id, newVersionId))
    ]);

    if (!originalVersion[0] || !newVersion[0]) {
      return res.status(404).json({ error: "One or both versions not found" });
    }

    const comparison = await compareVersions(
      originalVersion[0].content,
      newVersion[0].content
    );

    res.json(comparison);

  } catch (error: any) {
    console.error("Version comparison error:", error);
    res.status(500).json({ error: error.message });
  }
});


// Export document as PDF
router.get("/api/documents/:id/export/pdf", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const documentId = parseInt(req.params.id);
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document || document.userId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawText(document.content, {
      x: 50,
      y: page.getHeight() - 50,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });

    const pdfBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=contract-${documentId}.pdf`);
    res.send(Buffer.from(pdfBytes));

  } catch (error: any) {
    console.error("PDF export error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Export document as DOCX
router.get("/api/documents/:id/export/docx", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const documentId = parseInt(req.params.id);
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document || document.userId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Create Word document
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: document.content,
                size: 24,
              }),
            ],
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=contract-${documentId}.docx`);
    res.send(buffer);

  } catch (error: any) {
    console.error("DOCX export error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add digital signature to PDF
router.post("/api/documents/:id/sign", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const documentId = parseInt(req.params.id);
    const { signature } = req.body;

    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document || document.userId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Create PDF with signature
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Add content
    page.drawText(document.content, {
      x: 50,
      y: page.getHeight() - 50,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });

    // Add signature
    page.drawText(signature, {
      x: 50,
      y: 50,
      size: 12,
      font,
      color: rgb(0, 0, 1),
    });

    // Sign PDF -  This part needs a proper signing implementation.  This is a placeholder.
    const signPdf = new SignPdf();
    const signedPdf = await signPdf.sign(await pdfDoc.save());


    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=signed-contract-${documentId}.pdf`);
    res.send(Buffer.from(signedPdf));

  } catch (error: any) {
    console.error("Signing error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;