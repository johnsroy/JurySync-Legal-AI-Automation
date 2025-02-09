import { Anthropic } from '@anthropic-ai/sdk';
import { db } from '../db';
import { legalDocuments } from '@shared/schema';
import { eq } from 'drizzle-orm';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const COMPLIANCE_KEYWORDS = [
  'regulation', 'compliance', 'requirements', 'policy', 'guidelines',
  'standards', 'rules', 'procedures', 'audit', 'assessment',
  'control', 'risk', 'regulatory', 'framework', 'governance'
];

// Task management with persistent state
class TaskManager {
  private static instance: TaskManager;
  private tasks: Map<string, any>;
  private taskHistory: Map<string, any[]>;
  private taskResults: Map<string, any>;

  private constructor() {
    this.tasks = new Map();
    this.taskHistory = new Map();
    this.taskResults = new Map();
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
    this.taskResults.set(taskId, null);
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

  setTaskResult(taskId: string, result: any) {
    this.taskResults.set(taskId, result);
  }

  getTaskResult(taskId: string) {
    return this.taskResults.get(taskId);
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

  private async classifyDocument(text: string): Promise<{
    type: 'contract' | 'compliance' | 'research',
    confidence: number,
    keywords: string[]
  }> {
    // Simple keyword-based classification
    const textLower = text.toLowerCase();
    const matchedKeywords = COMPLIANCE_KEYWORDS.filter(keyword => 
      textLower.includes(keyword.toLowerCase())
    );

    // If we find multiple compliance keywords, classify as compliance
    if (matchedKeywords.length >= 2) {
      return {
        type: 'compliance',
        confidence: Math.min(matchedKeywords.length / 5, 1), // Normalize confidence
        keywords: matchedKeywords
      };
    }

    // If insufficient keywords found, use Claude for advanced classification
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Classify this document as either 'contract', 'compliance', or 'research'. First 500 chars:
            ${text.substring(0, 500)}

            Format response as JSON:
            {
              "type": "contract|compliance|research",
              "confidence": number between 0-1,
              "reasoning": "brief explanation"
            }`
          }
        ]
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format from Anthropic API');
    }

    const result = JSON.parse(content.text);
    return {
      type: result.type as 'contract' | 'compliance' | 'research',
      confidence: result.confidence,
      keywords: matchedKeywords
    };
  }

  async distributeTask(input: {
    type: 'contract' | 'compliance' | 'research',
    data: any
  }) {
    const taskId = `task_${Date.now()}`;

    try {
      // If type is not explicitly provided, classify the document
      if (!input.type && input.data.document) {
        const classification = await this.classifyDocument(input.data.document);
        input.type = classification.type;
        input.data.classification = classification;
      }

      const task = this.taskManager.createTask(taskId, input.type, input.data);

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
        analysis,
        estimatedCompletionTime: analysis.steps.reduce(
          (total: number, step: any) => total + parseInt(step.estimatedDuration), 
          0
        )
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

    const { analysis, data } = task;

    try {
      for (let i = 0; i < analysis.steps.length; i++) {
        const step = analysis.steps[i];

        this.taskManager.updateTask(taskId, {
          status: 'processing',
          currentStep: i,
          progress: Math.round((i / analysis.steps.length) * 90) + 10,
          currentStepDetails: step
        });

        // For compliance tasks, analyze the document
        if (task.type === 'compliance') {
          const documentAnalysis = await this.analyzeDocument(data.document);
          const stepResult = await this.verifyStepQuality(step, documentAnalysis);

          if (!stepResult.passed) {
            this.taskManager.updateTask(taskId, {
              status: 'quality_review',
              qualityIssues: stepResult.issues,
              progress: Math.round((i / analysis.steps.length) * 90) + 10
            });
            return;
          }

          // Store the final analysis result
          if (i === analysis.steps.length - 1) {
            this.taskManager.setTaskResult(taskId, {
              status: 'completed',
              data: documentAnalysis,
              completedAt: new Date().toISOString()
            });
          }
        }
      }

      // Task completed successfully
      this.taskManager.updateTask(taskId, {
        status: 'completed',
        progress: 100,
        completedAt: Date.now()
      });
    } catch (error: any) {
      console.error(`Error processing task ${taskId}:`, error);
      this.taskManager.updateTask(taskId, {
        status: 'error',
        error: error.message
      });
    }
  }

  private async analyzeDocument(documentText: string) {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this legal document for compliance issues and provide a detailed report:

            Document Text: ${documentText}

            Format response as JSON with:
            {
              "summary": "brief overview of the document",
              "riskRating": number between 1-5,
              "flaggedIssues": [
                {
                  "issue": "description of the issue",
                  "severity": "low|medium|high",
                  "section": "relevant section of the document",
                  "impact": "potential impact of the issue"
                }
              ],
              "recommendations": [
                {
                  "recommendation": "specific recommendation",
                  "priority": "low|medium|high",
                  "rationale": "explanation of the recommendation"
                }
              ]
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
  }

  private async verifyStepQuality(step: any, analysis: any) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Verify this analysis step's quality:
              Step: ${JSON.stringify(step, null, 2)}
              Analysis: ${JSON.stringify(analysis, null, 2)}

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

  async getTaskResult(taskId: string) {
    return this.taskManager.getTaskResult(taskId);
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