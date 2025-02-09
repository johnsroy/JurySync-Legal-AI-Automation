import { Router } from 'express';
import { orchestratorService } from '../services/orchestratorService';
import { z } from 'zod';

const router = Router();

const taskSchema = z.object({
  type: z.enum(['contract', 'compliance', 'research']),
  data: z.record(z.any())
});

// Create new task
router.post('/tasks', async (req, res) => {
  try {
    const taskData = taskSchema.parse(req.body);
    const result = await orchestratorService.distributeTask(taskData);
    res.json(result);
  } catch (error: any) {
    console.error('Task creation error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get task status
router.get('/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const status = await orchestratorService.monitorTask(taskId);
    res.json(status);
  } catch (error: any) {
    console.error('Task status error:', error);
    res.status(404).json({ error: error.message });
  }
});

// Get task history
router.get('/tasks/:taskId/history', async (req, res) => {
  try {
    const { taskId } = req.params;
    const history = await orchestratorService.getTaskHistory(taskId);
    res.json(history);
  } catch (error: any) {
    console.error('Task history error:', error);
    res.status(404).json({ error: error.message });
  }
});

// Get all tasks
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await orchestratorService.getAllTasks();
    res.json(tasks);
  } catch (error: any) {
    console.error('Tasks list error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
