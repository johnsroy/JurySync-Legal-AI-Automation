import { Router, Request, Response, NextFunction } from "express";
import { orchestratorService } from "../services/orchestratorService";
import { z } from "zod";
import multer from "multer";
import { db } from "../db";
import { documents } from "@shared/schema";
import { documentProcessor } from "../services/documentProcessor";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/json",
      "text/csv",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      cb(
        new Error(
          `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
        ),
      );
      return;
    }
    cb(null, true);
  },
}).single("file");

const router = Router();

// Enhanced logging for jury analysis
function log(
  message: string,
  type: "info" | "error" | "debug" = "info",
  context?: any,
) {
  const timestamp = new Date().toISOString();
  console.log(
    `[${timestamp}] [JurySync] [${type.toUpperCase()}] ${message}`,
    context ? JSON.stringify(context, null, 2) : "",
  );
}

// Input validation schemas
const taskRequestSchema = z.object({
  type: z.enum(["jury", "analysis", "research"]),
  data: z.object({
    timestamp: z.string(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    jurorData: z
      .object({
        demographics: z.boolean().optional(),
        socialMedia: z.boolean().optional(),
        questionnaire: z.boolean().optional(),
      })
      .optional(),
  }),
});

type TaskResponse = {
  taskId: string;
  status: string;
  type: string;
  metadata?: any;
  progress: number;
  currentStep?: number;
  currentStepDetails?: {
    name: string;
    description: string;
  };
  error?: string;
  metrics?: {
    automatedTasks: number;
    processingSpeed: number;
    laborCost: number;
    errorReduction: number;
  };
};

// Error handler middleware with proper typing
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      log("Route error:", "error", error);
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({
        error: error.message || "Internal server error",
        status: "error",
      });
    });
  };

// Upload document
router.post("/documents", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");

  upload(req, res, async (err: any) => {
    try {
      if (err) {
        log("File upload error:", "error", err);
        return res.status(400).json({
          error: err.message,
          status: "error",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded",
          status: "error",
        });
      }

      // Use documentProcessor instead of manual content extraction
      const processResult = await documentProcessor.processDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );

      if (!processResult.success || !processResult.content) {
        throw new Error("Failed to process document content");
      }

      const task = await orchestratorService.createTask({
        type: "jury",
        data: {
          document: processResult.content,
          filename: req.file.originalname,
          timestamp: new Date().toISOString(),
          priority: "normal",
          metadata: processResult.metadata,
          jurorData: {
            questionnaire: true,
            demographics: req.file.mimetype === "text/csv",
            socialMedia: false,
          },
        },
      });

      log("Jury document uploaded and task created", "info", {
        taskId: task.id,
        processingMetadata: processResult.metadata,
      });

      return res.status(200).json({
        taskId: task.id,
        status: "success",
      });
    } catch (error: any) {
      log("Document upload error:", "error", error);
      return res.status(500).json({
        error: error.message || "Failed to process document",
        status: "error",
      });
    }
  });
});

// Update the analyze endpoint
router.post("/analyze", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");

  upload(req, res, async (err: any) => {
    try {
      if (err) {
        log("File upload error:", "error", err);
        return res.status(400).json({
          error: err.message,
          status: "error",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded",
          status: "error",
        });
      }

      // Use documentProcessor for content extraction
      const processResult = await documentProcessor.processDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );

      if (!processResult.success || !processResult.content) {
        throw new Error("Failed to process document content");
      }

      // Create initial document record
      const [document] = await db
        .insert(documents)
        .values({
          userId: req.user?.id || 1,
          title: req.file.originalname,
          content: processResult.content,
          agentType: "COMPLIANCE_AUDITING",
          analysis: {},
          metadata: processResult.metadata,
        })
        .returning();

      // Perform document analysis
      const analysis = await analyzeDocument(
        document.id,
        processResult.content,
      );

      log("Document analysis completed:", "info", { analysis });

      return res.status(200).json({
        analysis,
        status: "success",
      });
    } catch (error: any) {
      log("Document analysis error:", "error", error);
      return res.status(500).json({
        error: error.message || "Failed to analyze document",
        status: "error",
      });
    }
  });
});

// Create new task
router.post(
  "/tasks",
  asyncHandler(async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    const validatedData = taskRequestSchema.parse(req.body);

    const task = await orchestratorService.createTask(validatedData);

    return res.json({
      taskId: task.id,
      status: "success",
      type: task.type,
    });
  }),
);

// Get all tasks
router.get(
  "/tasks",
  asyncHandler(async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    const tasks = await orchestratorService.getAllTasks();

    // Add metrics for each task
    const tasksWithMetrics = tasks.map((task) => ({
      ...task,
      metrics: {
        automatedTasks: Math.floor(Math.random() * 20) + 70, // 70-90%
        processingSpeed: Math.floor(Math.random() * 30) + 60, // 60-90%
        laborCost: Math.floor(Math.random() * 20) + 30, // 30-50%
        errorReduction: Math.floor(Math.random() * 20) + 50, // 50-70%
      },
    }));

    return res.json(tasksWithMetrics);
  }),
);

// Get task details
router.get(
  "/tasks/:taskId",
  asyncHandler(async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    const { taskId } = req.params;
    const task = await orchestratorService.getTask(taskId);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
        status: "error",
      });
    }

    // Add mock metrics for demo
    const taskWithMetrics: TaskResponse = {
      ...task,
      metrics: {
        automatedTasks: Math.floor(Math.random() * 20) + 70, // 70-90%
        processingSpeed: Math.floor(Math.random() * 30) + 60, // 60-90%
        laborCost: Math.floor(Math.random() * 20) + 30, // 30-50%
        errorReduction: Math.floor(Math.random() * 20) + 50, // 50-70%
      },
    };

    return res.json(taskWithMetrics);
  }),
);

// Retry failed task
router.post(
  "/tasks/:taskId/retry",
  asyncHandler(async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    const { taskId } = req.params;
    const task = await orchestratorService.retryTask(taskId);

    return res.json({
      taskId: task.id,
      status: "success",
    });
  }),
);

// Download task report
router.get(
  "/tasks/:taskId/report",
  asyncHandler(async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const task = await orchestratorService.getTask(taskId);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
        status: "error",
      });
    }

    if (task.progress < 100) {
      return res.status(400).json({
        error: "Task not completed",
        status: "error",
      });
    }

    const report = await orchestratorService.generateReport(taskId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="task-${taskId}-report.pdf"`,
    );

    return res.send(report);
  }),
);

export default router;
