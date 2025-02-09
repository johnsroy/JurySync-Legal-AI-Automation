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

// Shared memory to store agent states and tasks
class SharedMemory {
  private static instance: SharedMemory;
  private taskQueue: Map<string, any>;
  private contextStore: Map<string, any>;

  private constructor() {
    this.taskQueue = new Map();
    this.contextStore = new Map();
  }

  static getInstance(): SharedMemory {
    if (!SharedMemory.instance) {
      SharedMemory.instance = new SharedMemory();
    }
    return SharedMemory.instance;
  }

  addTask(taskId: string, task: any) {
    const timestamp = Date.now();
    this.taskQueue.set(taskId, { 
      ...task, 
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  updateTaskStatus(taskId: string, status: string, result?: any) {
    const task = this.taskQueue.get(taskId);
    if (task) {
      this.taskQueue.set(taskId, { 
        ...task, 
        status, 
        result,
        updatedAt: Date.now()
      });
    }
  }

  getTask(taskId: string) {
    return this.taskQueue.get(taskId);
  }

  setContext(key: string, value: any) {
    this.contextStore.set(key, value);
  }

  getContext(key: string) {
    return this.contextStore.get(key);
  }

  getAllTasks() {
    return Array.from(this.taskQueue.entries()).map(([id, task]) => ({
      id,
      type: task.type,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      ...task
    })).sort((a, b) => b.createdAt - a.createdAt);
  }
}

export class OrchestratorService {
  private static instance: OrchestratorService;
  private sharedMemory: SharedMemory;

  private constructor() {
    this.sharedMemory = SharedMemory.getInstance();
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
    this.sharedMemory.addTask(taskId, input);

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
              text: `Analyze this legal task and determine the required steps and agents:
              Task Type: ${input.type}
              Data: ${JSON.stringify(input.data, null, 2)}

              Provide your response as a JSON object with:
              {
                "requiredAgents": ["Array of required agent types"],
                "steps": ["Array of processing steps"],
                "riskFactors": ["Array of potential risks to monitor"],
                "qualityThresholds": {"key": "value" pairs of quality metrics}
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
      this.sharedMemory.setContext(`${taskId}_analysis`, analysis);

      // Initialize task progress tracking
      this.sharedMemory.updateTaskStatus(taskId, 'in_progress', {
        currentStep: 0,
        totalSteps: analysis.steps.length,
        startTime: Date.now(),
        analysis
      });

      // Start background processing
      this.processTask(taskId).catch(error => {
        console.error('Task processing error:', error);
        this.sharedMemory.updateTaskStatus(taskId, 'error', { error: error.message });
      });

      return {
        taskId,
        analysis
      };
    } catch (error: any) {
      console.error('Task distribution error:', error);
      this.sharedMemory.updateTaskStatus(taskId, 'error', { error: error.message });
      throw error;
    }
  }

  private async processTask(taskId: string) {
    const task = this.sharedMemory.getTask(taskId);
    const analysis = this.sharedMemory.getContext(`${taskId}_analysis`);

    if (!task || !analysis) {
      throw new Error('Task or analysis not found');
    }

    for (let i = 0; i < analysis.steps.length; i++) {
      try {
        // Update progress
        this.sharedMemory.updateTaskStatus(taskId, 'processing', {
          currentStep: i,
          totalSteps: analysis.steps.length,
          analysis
        });

        // Simulate step processing time
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check quality at each step
        const qualityCheck = await this.evaluateQuality(task, analysis.qualityThresholds);
        if (!qualityCheck.passed) {
          this.sharedMemory.updateTaskStatus(taskId, 'quality_review', {
            currentStep: i,
            totalSteps: analysis.steps.length,
            qualityCheck,
            analysis
          });
          return;
        }
      } catch (error: any) {
        console.error(`Error processing step ${i}:`, error);
        this.sharedMemory.updateTaskStatus(taskId, 'error', {
          error: error.message,
          currentStep: i,
          totalSteps: analysis.steps.length
        });
        return;
      }
    }

    // Task completed successfully
    this.sharedMemory.updateTaskStatus(taskId, 'completed', {
      currentStep: analysis.steps.length - 1,
      totalSteps: analysis.steps.length,
      completedAt: Date.now(),
      analysis
    });
  }

  async monitorTask(taskId: string) {
    const task = this.sharedMemory.getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const analysis = this.sharedMemory.getContext(`${taskId}_analysis`);
    if (!analysis) {
      throw new Error('Task analysis not found');
    }

    return {
      status: task.status,
      currentStep: task.result?.currentStep || 0,
      totalSteps: analysis.steps.length,
      qualityMetrics: task.result?.qualityCheck,
      analysis,
      updatedAt: task.updatedAt
    };
  }

  private async evaluateQuality(task: any, thresholds: Record<string, any>) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Evaluate this task's quality against the given thresholds:
              Task: ${JSON.stringify(task, null, 2)}
              Thresholds: ${JSON.stringify(thresholds, null, 2)}

              Provide your evaluation as a JSON object with:
              {
                "passed": boolean,
                "metrics": {"key": "value" pairs of measured metrics},
                "issues": ["Array of identified issues"],
                "recommendations": ["Array of improvement suggestions"]
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
      console.error('Quality evaluation error:', error);
      return {
        passed: false,
        error: error.message
      };
    }
  }

  async getTaskHistory(taskId: string) {
    const task = this.sharedMemory.getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    return {
      task,
      analysis: this.sharedMemory.getContext(`${taskId}_analysis`),
      history: this.sharedMemory.getContext(`${taskId}_history`) || []
    };
  }

  async getAllTasks() {
    return this.sharedMemory.getAllTasks();
  }
}

export const orchestratorService = OrchestratorService.getInstance();