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
    const [document] = await db
      .insert(documents)
      .values({
        userId: req.user.id,
        title,
        content: Buffer.from(content, 'base64').toString(),
        agentType,
        processingStatus: "PENDING"
      })
      .returning();

    // Create initial version
    await db
      .insert(documentVersions)
      .values({
        content: Buffer.from(content, 'base64').toString(),
        version: 1,
        authorId: req.user.id,
        documentId: document.id,
        changes: [{
          description: "Initial document upload",
          timestamp: new Date().toISOString(),
          user: req.user.username
        }]
      });

    // Analyze document content
    try {
      const analysis = await analyzeContractClauses(Buffer.from(content, 'base64').toString());

      // Update document with analysis
      await db
        .update(documents)
        .set({ 
          analysis,
          processingStatus: "COMPLETED"
        })
        .where(eq(documents.id, document.id));

      res.status(201).json({ ...document, analysis });
    } catch (error) {
      // Update document with error status but still return success
      await db
        .update(documents)
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

    const { requirements, baseContent, customInstructions } = req.body;
    const documentId = parseInt(req.params.id);

    if (!requirements || !Array.isArray(requirements)) {
      return res.status(400).json({ error: "Invalid requirements" });
    }

    // Check document exists and user has access
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document || document.userId !== req.user.id) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Generate draft using OpenAI
    const generatedContent = await generateContractDraft({
      requirements,
      baseContent,
      customInstructions
    });

    // Save as new version
    const [newVersion] = await db
      .insert(documentVersions)
      .values({
        documentId,
        content: generatedContent,
        version: document.currentVersion + 1,
        createdBy: req.user.id,
        changes: [{
          description: "Generated new draft from requirements",
          timestamp: new Date().toISOString(),
          user: req.user.username
        }]
      })
      .returning();

    // Update document's current version
    await db
      .update(documents)
      .set({ 
        currentVersion: document.currentVersion + 1,
        content: generatedContent
      })
      .where(eq(documents.id, documentId));

    res.json({ content: generatedContent, version: newVersion });

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

    if (!document || document.userId !== req.user.id) {
      return res.status(404).json({ error: "Document not found" });
    }

    const analysis = await analyzeContractClauses(document.content);
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

    if (!originalVersion || !newVersion) {
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