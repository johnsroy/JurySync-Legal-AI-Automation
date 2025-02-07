import { Router } from "express";
import { generateContractDraft, analyzeContractClauses, compareVersions } from "../services/openai";
import { db } from "../db";
import { documents, documentVersions } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

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

export default router;