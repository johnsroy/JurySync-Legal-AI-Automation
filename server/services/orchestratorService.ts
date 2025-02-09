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
    this.taskQueue.set(taskId, { ...task, status: 'pending' });
  }

  updateTaskStatus(taskId: string, status: string, result?: any) {
    const task = this.taskQueue.get(taskId);
    if (task) {
      this.taskQueue.set(taskId, { ...task, status, result });
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
      ...task
    }));
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

      // Update task with initial analysis
      this.sharedMemory.updateTaskStatus(taskId, 'analyzed', {
        analysis,
        currentStep: 0
      });

      return {
        taskId,
        analysis
      };
    } catch (error) {
      console.error('Task distribution error:', error);
      this.sharedMemory.updateTaskStatus(taskId, 'error', { error: error.message });
      throw error;
    }
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

    // Check quality thresholds and risk factors
    const qualityCheck = await this.evaluateQuality(task, analysis.qualityThresholds);
    if (!qualityCheck.passed) {
      // Handle quality issues
      this.sharedMemory.updateTaskStatus(taskId, 'quality_review', qualityCheck);
      return qualityCheck;
    }

    return {
      status: task.status,
      currentStep: task.result?.currentStep || 0,
      totalSteps: analysis.steps.length,
      qualityMetrics: qualityCheck
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
    } catch (error) {
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
