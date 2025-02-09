import { Router } from 'express';
import { orchestratorService } from '../services/orchestratorService';
import { z } from 'zod';

const router = Router();

// Enhanced logging
function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Orchestrator] [${type.toUpperCase()}] ${message}`, context ? context : '');
}

// Input validation schemas
const taskSchema = z.object({
  type: z.enum(['contract', 'compliance', 'research']),
  data: z.record(z.any())
});

const auditRequestSchema = z.object({
  document: z.string().min(1, "Document text cannot be empty"),
  metadata: z.object({
    documentType: z.enum(['contract', 'policy', 'regulation']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    tags: z.array(z.string()).optional()
  }).optional()
});

// Audit endpoint
router.post('/audit', async (req, res) => {
  try {
    log('Received audit request', 'info', { body: { ...req.body, document: '[REDACTED]' } });

    // Validate request
    const validatedData = auditRequestSchema.parse(req.body);

    // Create compliance audit task
    const task = {
      type: 'compliance',
      data: {
        document: validatedData.document,
        metadata: validatedData.metadata || {},
        requestedAt: new Date().toISOString()
      }
    };

    // Distribute task to orchestrator
    const result = await orchestratorService.distributeTask(task);

    log('Audit task created successfully', 'info', { taskId: result.taskId });

    res.json({
      taskId: result.taskId,
      status: 'processing',
      estimatedCompletionTime: result.estimatedCompletionTime
    });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Audit request failed', 'error', { error: errorMessage });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    res.status(500).json({
      error: 'Failed to process audit request',
      details: errorMessage,
      code: 'AUDIT_ERROR'
    });
  }
});

// Get task status
router.get('/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    log('Fetching task status', 'info', { taskId });

    const status = await orchestratorService.monitorTask(taskId);
    res.json(status);
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Task status fetch failed', 'error', { error: errorMessage });
    res.status(404).json({
      error: 'Failed to fetch task status',
      details: errorMessage,
      code: 'STATUS_ERROR'
    });
  }
});

// Get task results - specific endpoint for audit results
router.get('/audit/:taskId/result', async (req, res) => {
  try {
    const { taskId } = req.params;
    log('Fetching audit results', 'info', { taskId });

    const result = await orchestratorService.getTaskResult(taskId);

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

    res.json({
      status: 'completed',
      auditReport: {
        summary: result.data.summary,
        riskRating: result.data.riskRating,
        flaggedIssues: result.data.flaggedIssues,
        recommendations: result.data.recommendations,
        completedAt: result.completedAt
      }
    });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Failed to fetch audit results', 'error', { error: errorMessage });
    res.status(500).json({
      error: 'Failed to fetch audit results',
      details: errorMessage,
      code: 'RESULT_ERROR'
    });
  }
});

// Get all tasks
router.get('/tasks', async (req, res) => {
  try {
    log('Fetching all tasks');
    const tasks = await orchestratorService.getAllTasks();
    res.json(tasks);
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Failed to fetch tasks list', 'error', { error: errorMessage });
    res.status(500).json({
      error: 'Failed to fetch tasks',
      details: errorMessage,
      code: 'LIST_ERROR'
    });
  }
});

export default router;