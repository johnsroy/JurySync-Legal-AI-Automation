import { Router } from "express";
// For a simple, line-based diff:
import * as diff from "diff";

const router = Router();

interface DiffSegment {
  value: string;
  added?: boolean;
  removed?: boolean;
}

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

    // Create word-level diff
    const changes = diff.diffWords(originalText, proposedText);
    
    // Transform into segments with proper formatting
    const segments: DiffSegment[] = changes.map(change => ({
      value: change.value,
      added: change.added,
      removed: change.removed
    }));

    return res.json({ 
      segments,
      summary: {
        additions: changes.filter(c => c.added).length,
        deletions: changes.filter(c => c.removed).length,
        unchanged: changes.filter(c => !c.added && !c.removed).length
      }
    });
  } catch (error) {
    console.error("Redline route error:", error);
    return res.status(500).json({ error: "Redline comparison failed" });
  }
});

export default router; 