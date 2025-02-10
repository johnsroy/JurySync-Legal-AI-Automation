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

// Get task results with improved error handling and logging
router.get('/audit/:taskId/result', async (req, res) => {
  const requestTimeout = 60000; // Increased to 60 second timeout
  let timeoutId: NodeJS.Timeout | undefined;

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

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!result) {
      log('Audit results not found', 'error', { taskId });
      return res.status(404).json({
        error: 'Audit results not found',
        code: 'NOT_FOUND'
      });
    }

    log('Task result status', 'debug', { 
      taskId, 
      status: result.status,
      resultKeys: result.data ? Object.keys(result.data) : null
    });

    if (result.status === 'processing') {
      log('Task still processing', 'info', { taskId, progress: result.progress });
      return res.status(202).json({
        status: 'processing',
        progress: result.progress
      });
    }

    if (result.status === 'error') {
      log('Task failed', 'error', { taskId, error: result.error });
      return res.status(500).json({
        status: 'error',
        error: result.error || 'Unknown error occurred'
      });
    }

    try {
      log('Returning completed task result', 'info', { 
        taskId,
        hasAuditReport: !!result.data?.auditReport,
        completedAt: result.completedAt
      });

      res.json({
        status: 'completed',
        ...result.data,
        metadata: result.metadata,
        completedAt: result.completedAt
      });

    } catch (validationError) {
      log('Result validation failed', 'error', {
        error: validationError instanceof Error ? validationError.message : 'Unknown validation error',
        taskId
      });

      res.status(500).json({
        error: 'Invalid result format',
        details: validationError instanceof Error ? validationError.message : 'Unknown validation error',
        code: 'INVALID_RESULT_FORMAT'
      });
    }

  } catch (error: any) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

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

// Post new audit request with improved error handling
router.post('/audit', async (req, res) => {
  const requestTimeout = 60000; // 60 second timeout
  let timeoutId: NodeJS.Timeout | undefined;

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

    // Distribute task with timeout
    const resultPromise = orchestratorService.distributeTask(task);
    const result = await Promise.race([resultPromise, timeoutPromise]);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    log('Audit task created successfully', 'info', { taskId: result.taskId });

    res.json({
      taskId: result.taskId,
      status: 'processing',
      estimatedCompletionTime: new Date(Date.now() + 5 * 60 * 1000).toISOString() // Estimate 5 minutes
    });

  } catch (error: any) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

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