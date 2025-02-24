import { Router } from "express";
import { AIOrchestrator } from "../services/ai-orchestrator";
import multer from "multer";
import { z } from "zod";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  },
});

const aiOrchestrator = new AIOrchestrator();

// Document processing endpoint
router.post("/process", upload.single("document"), async (req, res) => {
  try {
    let content: string;
    let type: "upload" | "paste";

    if (req.file) {
      content = req.file.buffer.toString();
      type = "upload";
    } else {
      const validation = z
        .object({
          content: z.string().min(1),
          type: z.enum(["upload", "paste"]),
        })
        .safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid document data",
        });
      }
      content = validation.data.content;
      type = validation.data.type;
    }

    // Process document through all stages
    const result = await aiOrchestrator.processDocument(content, type);
    return res.json(result);
  } catch (error) {
    console.error("Workflow automation error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Processing failed",
    });
  }
});

export default router;
