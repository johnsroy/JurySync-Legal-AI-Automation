import { Router } from "express";
// For a simple, line-based diff:
import * as diff from "diff";

const router = Router();

// POST /api/redline
router.post("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { originalText, proposedText } = req.body;
    if (!originalText || !proposedText) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Example approach using 'diff' (line or word-based).
    // In the future, you could call a Pydantic AI or LLM-based agent here.
    const changes = diff.diffWords(originalText, proposedText);
    let diffText = "";
    for (const part of changes) {
      const colorMark = part.added ? "[+]" : part.removed ? "[-]" : "";
      diffText += `${colorMark}${part.value}`;
    }

    return res.json({ diff_text: diffText });
  } catch (error) {
    console.error("Redline route error:", error);
    return res.status(500).json({ error: "Redline comparison failed" });
  }
});

export default router; 