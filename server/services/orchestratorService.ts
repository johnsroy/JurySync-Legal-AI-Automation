import { Anthropic } from '@anthropic-ai/sdk';
import { db } from '../db';
import { legalDocuments } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Initialize Anthropic client
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Task management with persistent state
class TaskManager {
  private static instance: TaskManager;
  private tasks: Map<string, any>;
  private taskHistory: Map<string, any[]>;

  private constructor() {
    this.tasks = new Map();
    this.taskHistory = new Map();
  }

  static getInstance(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager();
    }
    return TaskManager.instance;
  }

  createTask(taskId: string, type: string, data: any) {
    const timestamp = Date.now();
    const task = {
      id: taskId,
      type,
      data,
      status: 'pending',
      progress: 0,
      events: [{
        timestamp,
        status: 'created',
        details: 'Task created and pending analysis'
      }],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.tasks.set(taskId, task);
    this.taskHistory.set(taskId, []);
    return task;
  }

  updateTask(taskId: string, updates: Partial<any>) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');

    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: Date.now()
    };

    // Record the update in history
    const history = this.taskHistory.get(taskId) || [];
    history.push({
      timestamp: Date.now(),
      changes: updates,
      previousState: { ...task }
    });

    this.tasks.set(taskId, updatedTask);
    this.taskHistory.set(taskId, history);
    return updatedTask;
  }

  getTask(taskId: string) {
    return this.tasks.get(taskId);
  }

  getAllTasks() {
    return Array.from(this.tasks.values())
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getTaskHistory(taskId: string) {
    return this.taskHistory.get(taskId) || [];
  }
}

export class OrchestratorService {
  private static instance: OrchestratorService;
  private taskManager: TaskManager;

  private constructor() {
    this.taskManager = TaskManager.getInstance();
  }

  static getInstance(): OrchestratorService {
    if (!OrchestratorService.instance) {
      OrchestratorService.instance = new OrchestratorService();
    }
    return OrchestratorService.instance;
  }

  async distributeTask(input: {
    type: 'contract' | 'compliance' | 'research',
    data: any
  }) {
    const taskId = `task_${Date.now()}`;
    const task = this.taskManager.createTask(taskId, input.type, input.data);

    try {
      // Analyze task requirements using Claude
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this ${input.type} task and provide execution plan:
              Task Data: ${JSON.stringify(input.data, null, 2)}

              Format response as JSON with:
              {
                "steps": [
                  {
                    "name": "step name",
                    "description": "detailed description",
                    "estimatedDuration": "duration in minutes",
                    "requiredAgents": ["agent types needed"],
                    "outputs": ["expected outputs"]
                  }
                ],
                "riskFactors": ["potential risks"],
                "qualityChecks": {
                  "accuracy": "minimum required accuracy",
                  "completeness": "completeness criteria",
                  "reliability": "reliability requirements"
                }
              }`
            }
          ]
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Anthropic API');
      }

      const analysis = JSON.parse(content.text);

      // Update task with analysis and start processing
      this.taskManager.updateTask(taskId, {
        status: 'analyzing',
        analysis,
        progress: 10,
        currentStep: 0,
        totalSteps: analysis.steps.length
      });

      // Start processing in background
      this.processTask(taskId).catch(error => {
        console.error(`Task processing error (${taskId}):`, error);
        this.taskManager.updateTask(taskId, {
          status: 'error',
          error: error.message,
          progress: 0
        });
      });

      return {
        taskId,
        status: 'analyzing',
        analysis
      };

    } catch (error: any) {
      console.error('Task distribution error:', error);
      this.taskManager.updateTask(taskId, {
        status: 'error',
        error: error.message,
        progress: 0
      });
      throw error;
    }
  }

  private async processTask(taskId: string) {
    const task = this.taskManager.getTask(taskId);
    if (!task) throw new Error('Task not found');

    const { analysis } = task;

    for (let i = 0; i < analysis.steps.length; i++) {
      const step = analysis.steps[i];
      try {
        this.taskManager.updateTask(taskId, {
          status: 'processing',
          currentStep: i,
          progress: Math.round((i / analysis.steps.length) * 90) + 10,
          currentStepDetails: step
        });

        // Simulate step processing (replace with actual processing logic)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify step completion
        const stepResult = await this.verifyStepQuality(step, task);
        if (!stepResult.passed) {
          this.taskManager.updateTask(taskId, {
            status: 'quality_review',
            qualityIssues: stepResult.issues,
            progress: Math.round((i / analysis.steps.length) * 90) + 10
          });
          return;
        }

      } catch (error: any) {
        console.error(`Error processing step ${i} for task ${taskId}:`, error);
        this.taskManager.updateTask(taskId, {
          status: 'error',
          error: error.message,
          progress: Math.round((i / analysis.steps.length) * 90) + 10
        });
        return;
      }
    }

    // Task completed successfully
    this.taskManager.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      completedAt: Date.now()
    });
  }

  private async verifyStepQuality(step: any, task: any) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Verify this step's quality:
              Step: ${JSON.stringify(step, null, 2)}
              Task Context: ${JSON.stringify(task, null, 2)}

              Format response as JSON with:
              {
                "passed": boolean,
                "score": number (0-100),
                "issues": ["list of issues if any"],
                "recommendations": ["improvement suggestions"]
              }`
            }
          ]
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Anthropic API');
      }

      return JSON.parse(content.text);
    } catch (error: any) {
      console.error('Quality verification error:', error);
      return {
        passed: false,
        score: 0,
        issues: [error.message]
      };
    }
  }

  async monitorTask(taskId: string) {
    const task = this.taskManager.getTask(taskId);
    if (!task) throw new Error('Task not found');

    return {
      ...task,
      history: this.taskManager.getTaskHistory(taskId)
    };
  }

  async getAllTasks() {
    return this.taskManager.getAllTasks();
  }
}

export const orchestratorService = OrchestratorService.getInstance();