import { Router } from 'express';
import { orchestratorService } from '../services/orchestratorService';
import { z } from 'zod';

const router = Router();

// Enhanced logging
function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Orchestrator] [${type.toUpperCase()}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
}

// Input validation schemas
const auditRequestSchema = z.object({
  documentText: z.string().min(1, "Document text cannot be empty"),
  metadata: z.object({
    documentType: z.enum(['contract', 'policy', 'regulation']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    tags: z.array(z.string()).optional()
  }).optional()
});

// Response validation schemas
const visualizationDataSchema = z.object({
  issueFrequency: z.array(z.number()),
  riskTrend: z.array(z.number()),
  complianceScores: z.object({
    overall: z.number().min(0).max(100),
    regulatory: z.number().min(0).max(100),
    clarity: z.number().min(0).max(100),
    risk: z.number().min(0).max(100)
  })
});

const auditReportSchema = z.object({
  auditReport: z.object({
    summary: z.string(),
    flaggedIssues: z.array(z.object({
      issue: z.string(),
      riskScore: z.number().min(1).max(10),
      severity: z.enum(['low', 'medium', 'high']),
      section: z.string(),
      recommendation: z.string(),
      regulatoryReference: z.string(),
      impact: z.string()
    })),
    riskScores: z.object({
      average: z.number().min(1).max(10),
      max: z.number().min(1).max(10),
      min: z.number().min(1).max(10),
      distribution: z.object({
        high: z.number(),
        medium: z.number(),
        low: z.number()
      })
    }),
    recommendedActions: z.array(z.object({
      action: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
      timeline: z.enum(['immediate', 'short-term', 'long-term']),
      impact: z.string()
    })),
    visualizationData: visualizationDataSchema
  })
});

// Audit endpoint with timeout handling
router.post('/audit', async (req, res) => {
  const requestTimeout = 60000; // 60 second timeout
  let timeoutId: NodeJS.Timeout;

  try {
    log('Received audit request', 'info', { body: { ...req.body, documentText: '[REDACTED]' } });

    // Validate request
    const validatedData = auditRequestSchema.parse(req.body);

    // Create compliance audit task
    const task = {
      type: 'compliance' as const,
      data: {
        document: validatedData.documentText,
        metadata: validatedData.metadata || {},
        requestedAt: new Date().toISOString()
      }
    };

    // Set up timeout handler
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Request timeout exceeded'));
      }, requestTimeout);
    });

    // Distribute task to orchestrator with timeout
    const resultPromise = orchestratorService.distributeTask(task);

    // Race between timeout and task distribution
    const result = await Promise.race([resultPromise, timeoutPromise]);

    clearTimeout(timeoutId);

    log('Audit task created successfully', 'info', { taskId: result.taskId });

    res.json({
      taskId: result.taskId,
      status: 'processing',
      estimatedCompletionTime: new Date(Date.now() + 5 * 60 * 1000).toISOString() // Estimate 5 minutes
    });

  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);

    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Audit request failed', 'error', { error: errorMessage });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    if (error.message === 'Request timeout exceeded') {
      return res.status(504).json({
        error: 'Request timed out',
        details: 'The server took too long to process the request',
        code: 'TIMEOUT_ERROR'
      });
    }

    res.status(500).json({
      error: 'Failed to process audit request',
      details: errorMessage,
      code: 'AUDIT_ERROR'
    });
  }
});

// Get task results with timeout handling
router.get('/audit/:taskId/result', async (req, res) => {
  const requestTimeout = 30000; // 30 second timeout
  let timeoutId: NodeJS.Timeout;

  try {
    const { taskId } = req.params;
    log('Fetching audit results', 'info', { taskId });

    // Set up timeout handler
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Request timeout exceeded'));
      }, requestTimeout);
    });

    // Get result with timeout
    const resultPromise = orchestratorService.getTaskResult(taskId);
    const result = await Promise.race([resultPromise, timeoutPromise]);

    clearTimeout(timeoutId);

    if (!result) {
      return res.status(404).json({
        error: 'Audit results not found',
        code: 'NOT_FOUND'
      });
    }

    if (result.status === 'processing') {
      return res.status(202).json({
        status: 'processing',
        progress: result.progress
      });
    }

    try {
      // Validate the audit report structure
      const validatedResult = auditReportSchema.parse(result.data);

      // Return the validated audit report
      res.json({
        status: 'completed',
        ...validatedResult,
        metadata: result.data.metadata,
        completedAt: result.completedAt
      });

    } catch (validationError) {
      log('Audit report validation failed', 'error', {
        error: validationError instanceof z.ZodError ? validationError.errors : validationError,
        taskId
      });

      res.status(500).json({
        error: 'Invalid audit report format',
        details: validationError instanceof z.ZodError ? 
          validationError.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          })) : 'Unexpected validation error',
        code: 'INVALID_REPORT_FORMAT'
      });
    }

  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);

    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Failed to fetch audit results', 'error', { error: errorMessage });

    if (error.message === 'Request timeout exceeded') {
      return res.status(504).json({
        error: 'Request timed out',
        details: 'The server took too long to process the request',
        code: 'TIMEOUT_ERROR'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch audit results',
      details: errorMessage,
      code: 'RESULT_ERROR'
    });
  }
});

// Get task status with timeout
router.get('/tasks/:taskId', async (req, res) => {
  const requestTimeout = 10000; // 10 second timeout
  let timeoutId: NodeJS.Timeout;

  try {
    const { taskId } = req.params;
    log('Fetching task status', 'info', { taskId });

    // Set up timeout handler
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Request timeout exceeded'));
      }, requestTimeout);
    });

    // Get status with timeout
    const statusPromise = orchestratorService.monitorTask(taskId);
    const status = await Promise.race([statusPromise, timeoutPromise]);

    clearTimeout(timeoutId);
    res.json(status);
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);

    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Task status fetch failed', 'error', { error: errorMessage });

    if (error.message === 'Request timeout exceeded') {
      return res.status(504).json({
        error: 'Request timed out',
        details: 'The server took too long to process the request',
        code: 'TIMEOUT_ERROR'
      });
    }

    res.status(404).json({
      error: 'Failed to fetch task status',
      details: errorMessage,
      code: 'STATUS_ERROR'
    });
  }
});

// Get all tasks with timeout
router.get('/tasks', async (req, res) => {
  const requestTimeout = 10000; // 10 second timeout
  let timeoutId: NodeJS.Timeout;

  try {
    log('Fetching all tasks');

    // Set up timeout handler
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Request timeout exceeded'));
      }, requestTimeout);
    });

    // Get tasks with timeout
    const tasksPromise = orchestratorService.getAllTasks();
    const tasks = await Promise.race([tasksPromise, timeoutPromise]);

    clearTimeout(timeoutId);
    res.json(tasks);
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);

    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Failed to fetch tasks list', 'error', { error: errorMessage });

    if (error.message === 'Request timeout exceeded') {
      return res.status(504).json({
        error: 'Request timed out',
        details: 'The server took too long to process the request',
        code: 'TIMEOUT_ERROR'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch tasks',
      details: errorMessage,
      code: 'LIST_ERROR'
    });
  }
});

export default router;