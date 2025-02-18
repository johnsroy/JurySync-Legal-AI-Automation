import { Router, Request, Response, NextFunction } from 'express';
import { orchestratorService } from '../services/orchestratorService';
import { z } from 'zod';
import multer from 'multer';
import mammoth from 'mammoth';
import { db } from '../db';
import { documents } from '@shared/schema';
import { analyzeDocument } from '../services/document-analysis';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/json',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
      return;
    }
    cb(null, true);
  }
}).single('file');

const router = Router();

// Input validation schemas
const taskRequestSchema = z.object({
  type: z.enum(['research', 'contract', 'compliance']),
  data: z.object({
    timestamp: z.string(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    document: z.string().optional(),
    filename: z.string().optional(),
    metadata: z.record(z.any()).optional()
  })
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
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error('Route error:', error);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({
        error: error.message || 'Internal server error',
        status: 'error'
      });
    });
  };

// Upload document
router.post('/documents', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');

  upload(req, res, async (err: any) => {
    try {
      if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({
          error: err.message,
          status: 'error'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          status: 'error'
        });
      }

      // Extract text content based on file type
      let content = '';
      if (req.file.mimetype === 'text/plain' || req.file.mimetype === 'text/csv') {
        content = req.file.buffer.toString('utf-8');
      } else if (req.file.mimetype.includes('wordprocessingml')) {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        content = result.value;
      } else {
        content = req.file.buffer.toString('utf-8');
      }

      const task = await orchestratorService.createTask({
        type: 'research',
        data: {
          document: content,
          filename: req.file.originalname,
          timestamp: new Date().toISOString(),
          priority: 'normal',
          metadata: {
            documentType: req.file.mimetype,
            fileSize: req.file.size
          }
        }
      });

      console.log('Document uploaded and task created', { taskId: task.id });

      return res.status(200).json({
        taskId: task.id,
        status: 'success'
      });

    } catch (error: any) {
      console.error('Document upload error:', error);
      return res.status(500).json({
        error: error.message || 'Failed to process document',
        status: 'error'
      });
    }
  });
});

// Update the analyze endpoint
router.post('/analyze', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');

  upload(req, res, async (err: any) => {
    try {
      if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({
          error: err.message,
          status: 'error'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          status: 'error'
        });
      }

      // Extract text content based on file type
      let content = '';
      if (req.file.mimetype === 'text/plain' || req.file.mimetype === 'text/csv') {
        content = req.file.buffer.toString('utf-8');
      } else if (req.file.mimetype.includes('wordprocessingml')) {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        content = result.value;
      } else {
        content = req.file.buffer.toString('utf-8');
      }

      // Create initial document record
      const [document] = await db.insert(documents)
        .values({
          userId: req.user?.id || 1, // Default to 1 if no user
          title: req.file.originalname,
          content: content,
          agentType: "COMPLIANCE_AUDITING",
          analysis: {}, // Empty initial analysis
        })
        .returning();

      // Perform document analysis
      const analysis = await analyzeDocument(document.id, content);

      console.log('Document analysis completed:', { analysis });

      return res.status(200).json({
        analysis,
        status: 'success'
      });

    } catch (error: any) {
      console.error('Document analysis error:', error);
      return res.status(500).json({
        error: error.message || 'Failed to analyze document',
        status: 'error'
      });
    }
  });
});

// Create new task
router.post('/tasks', asyncHandler(async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  const validatedData = taskRequestSchema.parse(req.body);

  const task = await orchestratorService.createTask(validatedData);

  return res.json({
    taskId: task.id,
    status: 'success',
    type: task.type
  });
}));

// Get all tasks
router.get('/tasks', asyncHandler(async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  const tasks = await orchestratorService.getAllTasks();

  // Add metrics for each task
  const tasksWithMetrics = tasks.map(task => ({
    ...task,
    metrics: {
      automatedTasks: Math.floor(Math.random() * 20) + 70, // 70-90%
      processingSpeed: Math.floor(Math.random() * 30) + 60, // 60-90%
      laborCost: Math.floor(Math.random() * 20) + 30, // 30-50%
      errorReduction: Math.floor(Math.random() * 20) + 50 // 50-70%
    }
  }));

  return res.json(tasksWithMetrics);
}));

// Get task details
router.get('/tasks/:taskId', asyncHandler(async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  const { taskId } = req.params;
  const task = await orchestratorService.getTask(taskId);

  if (!task) {
    return res.status(404).json({
      error: 'Task not found',
      status: 'error'
    });
  }

  // Add mock metrics for demo
  const taskWithMetrics: TaskResponse = {
    ...task,
    metrics: {
      automatedTasks: Math.floor(Math.random() * 20) + 70, // 70-90%
      processingSpeed: Math.floor(Math.random() * 30) + 60, // 60-90%
      laborCost: Math.floor(Math.random() * 20) + 30, // 30-50%
      errorReduction: Math.floor(Math.random() * 20) + 50 // 50-70%
    }
  };

  return res.json(taskWithMetrics);
}));

// Retry failed task
router.post('/tasks/:taskId/retry', asyncHandler(async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  const { taskId } = req.params;
  const task = await orchestratorService.retryTask(taskId);

  return res.json({
    taskId: task.id,
    status: 'success'
  });
}));

// Download task report
router.get('/tasks/:taskId/report', asyncHandler(async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const task = await orchestratorService.getTask(taskId);

  if (!task) {
    return res.status(404).json({
      error: 'Task not found',
      status: 'error'
    });
  }

  if (task.progress < 100) {
    return res.status(400).json({
      error: 'Task not completed',
      status: 'error'
    });
  }

  const report = await orchestratorService.generateReport(taskId);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="task-${taskId}-report.pdf"`);

  return res.send(report);
}));

export default router;