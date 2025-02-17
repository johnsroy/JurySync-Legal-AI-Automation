import { Router } from "express";
import * as diff from "diff";

const router = Router();

interface DiffSegment {
  value: string;
  added?: boolean;
  removed?: boolean;
}

interface RedlineResponse {
  segments: DiffSegment[];
  summary: {
    additions: number;
    deletions: number;
    unchanged: number;
  };
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
    const changes: diff.Change[] = diff.diffWords(originalText, proposedText);

    // Transform into segments with proper formatting
    const segments: DiffSegment[] = changes.map((change) => ({
      value: change.value,
      added: change.added,
      removed: change.removed
    }));

    const response: RedlineResponse = {
      segments,
      summary: {
        additions: changes.filter(c => c.added).length,
        deletions: changes.filter(c => c.removed).length,
        unchanged: changes.filter(c => !c.added && !c.removed).length
      }
    };

    return res.json(response);
  } catch (error) {
    console.error("Redline route error:", error);
    return res.status(500).json({ error: "Redline comparison failed" });
  }
});

export default router;