import { Anthropic } from '@anthropic-ai/sdk';
import { complianceAuditService } from './complianceAuditService';
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

const validateAuditReport = (report: any) => {
  if (!report?.auditReport) {
    throw new Error('Missing auditReport structure');
  }

  const { auditReport } = report;

  // Validate required sections
  const requiredSections = [
    'summary',
    'flaggedIssues',
    'riskScores',
    'recommendedActions',
    'visualizationData'
  ];

  const missingSections = requiredSections.filter(section => !auditReport[section]);
  if (missingSections.length > 0) {
    throw new Error(`Missing required sections: ${missingSections.join(', ')}`);
  }

  // Validate sub-structures
  if (!Array.isArray(auditReport.flaggedIssues)) {
    throw new Error('flaggedIssues must be an array');
  }

  if (!auditReport.riskScores?.distribution ||
      typeof auditReport.riskScores.average !== 'number') {
    throw new Error('Invalid riskScores structure');
  }

  if (!Array.isArray(auditReport.recommendedActions)) {
    throw new Error('recommendedActions must be an array');
  }

  if (!auditReport.visualizationData?.complianceScores ||
      !Array.isArray(auditReport.visualizationData.riskTrend)) {
    throw new Error('Invalid visualizationData structure');
  }

  return true;
};

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
        status: 'processing',
        type: input.type,
        classification: input.data.classification,
        metadata: {
          createdAt: new Date().toISOString(),
          documentLength: input.data.document?.length || 0
        }
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

    const { data } = task;

    try {
      this.taskManager.updateTask(taskId, {
        status: 'processing',
        progress: 25
      });

      let result;

      // Process based on task type
      if (task.type === 'compliance') {
        // Use the compliance audit service
        result = await complianceAuditService.analyzeDocument(data.document);

        // Validate the audit report structure
        try {
          validateAuditReport(result);
        } catch (error) {
          console.error('Invalid audit report structure:', error);
          throw new Error(`Audit report validation failed: ${error.message}`);
        }

        this.taskManager.updateTask(taskId, {
          status: 'completed',
          progress: 100,
          completedAt: new Date().toISOString()
        });

        // Store the validated result
        this.taskManager.setTaskResult(taskId, {
          status: 'completed',
          data: result,
          completedAt: new Date().toISOString()
        });

        // Log successful completion
        console.log(`Task ${taskId} completed successfully with validated audit report`);

      } else {
        throw new Error(`Unsupported task type: ${task.type}`);
      }

    } catch (error: any) {
      console.error(`Error processing task ${taskId}:`, error);
      this.taskManager.updateTask(taskId, {
        status: 'error',
        error: error.message,
        progress: 0
      });

      // Store error result
      this.taskManager.setTaskResult(taskId, {
        status: 'error',
        error: error.message,
        completedAt: new Date().toISOString()
      });
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