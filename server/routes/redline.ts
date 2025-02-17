import { Router } from "express";
import * as diff from "diff";
import PDFDocument from "pdfkit";
import { Readable } from "stream";

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

interface TextChange {
  type: 'insertion' | 'deletion';
  content: string;
  timestamp: Date;
  position: number;
}

// POST /api/redline (original functionality)
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

// POST /api/redline/export (new functionality)
router.post("/export", async (req, res) => {
  try {
    const { content, changes } = req.body;

    // Create a new PDF document
    const doc = new PDFDocument();

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=document-with-changes.pdf');

    // Pipe the PDF document to the response
    doc.pipe(res);

    // Add a title
    doc
      .fontSize(20)
      .text('Document with Tracked Changes', { align: 'center' })
      .moveDown(2);

    // Add the main content with changes highlighted
    doc.fontSize(12);

    let currentPosition = 0;
    const sortedChanges = [...changes].sort((a, b) => a.position - b.position);

    // Process the document content with changes
    for (const change of sortedChanges) {
      // Add text before the change
      if (change.position > currentPosition) {
        doc.text(content.slice(currentPosition, change.position), {
          continued: true,
          align: 'left'
        });
      }

      // Add the changed text with appropriate styling
      if (change.type === 'insertion') {
        doc
          .fillColor('green')
          .text(change.content, {
            continued: true,
            underline: true
          })
          .fillColor('black');
      } else {
        doc
          .fillColor('red')
          .text(change.content, {
            continued: true,
            strike: true
          })
          .fillColor('black');
      }

      currentPosition = change.position + change.content.length;
    }

    // Add any remaining text
    if (currentPosition < content.length) {
      doc.text(content.slice(currentPosition));
    }

    // Add change history
    doc
      .moveDown(2)
      .fontSize(16)
      .text('Change History', { underline: true })
      .moveDown();

    changes.forEach((change: TextChange) => {
      doc
        .fontSize(12)
        .fillColor(change.type === 'insertion' ? 'green' : 'red')
        .text(
          `${change.type === 'insertion' ? 'Added' : 'Removed'}: "${change.content}" at ${new Date(change.timestamp).toLocaleString()}`
        )
        .fillColor('black');
    });

    // Finalize the PDF
    doc.end();

  } catch (error) {
    console.error("PDF export error:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

export default router;