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

// Enhanced logging function
function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Orchestrator] [${type.toUpperCase()}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
}

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
    this.updateTask(taskId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      progress: 100
    });
  }

  getTaskResult(taskId: string) {
    const result = this.taskResults.get(taskId);
    const task = this.tasks.get(taskId);
    if (!task) {
      return {
        status: 'error',
        error: 'Task not found',
        details: 'The requested task ID does not exist'
      };
    }

    if (task.status === 'error') {
      return {
        status: 'error',
        error: task.error,
        details: task.errorDetails || 'An error occurred during processing'
      };
    }

    if (task.status === 'processing') {
      return {
        status: 'processing',
        progress: task.progress,
        message: 'Document analysis in progress'
      };
    }

    return {
      status: result ? 'completed' : task.status,
      data: result,
      progress: task.progress,
      error: task.error,
      completedAt: task.completedAt
    };
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
    try {
      log('Starting document classification', 'info');

      // Simple keyword-based classification
      const textLower = text.toLowerCase();
      const matchedKeywords = COMPLIANCE_KEYWORDS.filter(keyword =>
        textLower.includes(keyword.toLowerCase())
      );

      // If we find multiple compliance keywords, classify as compliance
      if (matchedKeywords.length >= 2) {
        log('Document classified via keywords', 'info', {
          type: 'compliance',
          confidence: Math.min(matchedKeywords.length / 5, 1),
          matchedKeywords
        });

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

      log('Document classified via AI', 'info', {
        type: result.type,
        confidence: result.confidence,
        reasoning: result.reasoning
      });

      return {
        type: result.type as 'contract' | 'compliance' | 'research',
        confidence: result.confidence,
        keywords: matchedKeywords
      };
    } catch (error: any) {
      log('Document classification failed', 'error', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Classification failed: ${error.message}`);
    }
  }

  async distributeTask(input: {
    type: 'contract' | 'compliance' | 'research',
    data: any
  }) {
    const taskId = `task_${Date.now()}`;

    // Add detailed logging of input
    log('Received audit request', 'info', { 
      taskId,
      inputType: input.type,
      hasData: !!input.data,
      dataKeys: input.data ? Object.keys(input.data) : [],
      documentTextLength: input.data?.documentText?.length,
      documentTextType: typeof input.data?.documentText,
      rawInput: JSON.stringify(input)
    });

    try {
      // Enhanced input validation
      if (!input?.data) {
        throw new Error('Request data is required');
      }

      if (!input.data.documentText) {
        throw new Error('Document text is missing from request');
      }

      if (typeof input.data.documentText !== 'string') {
        throw new Error(`Invalid document text type: ${typeof input.data.documentText}`);
      }

      if (input.data.documentText.trim().length === 0) {
        throw new Error('Document text cannot be empty');
      }

      if (!input.type || !['contract', 'compliance', 'research'].includes(input.type)) {
        throw new Error(`Invalid document type: ${input.type}`);
      }

      // Create task with validated data
      const task = this.taskManager.createTask(taskId, input.type, {
        ...input.data,
        documentText: input.data.documentText.trim()
      });

      log('Audit task created successfully', 'info', { 
        taskId,
        documentLength: input.data.documentText.length,
        type: input.type
      });

      // Start processing in background
      this.processTask(taskId).catch(error => {
        log('Task processing error', 'error', {
          taskId,
          error: error.message,
          stack: error.stack
        });

        this.taskManager.updateTask(taskId, {
          status: 'error',
          error: error.message,
          errorDetails: error.stack,
          progress: 0
        });
      });

      return {
        taskId,
        status: 'processing',
        type: input.type,
        metadata: {
          createdAt: new Date().toISOString(),
          documentLength: input.data.documentText.length
        }
      };

    } catch (error: any) {
      log('Task distribution error:', 'error', {
        taskId,
        error: error.message,
        stack: error.stack,
        inputData: JSON.stringify(input)
      });

      this.taskManager.updateTask(taskId, {
        status: 'error',
        error: error.message,
        errorDetails: error.stack,
        progress: 0
      });

      throw error;
    }
  }

  private async processTask(taskId: string) {
    const task = this.taskManager.getTask(taskId);
    if (!task) throw new Error('Task not found');

    const { data } = task;
    log('Starting task processing', 'info', { taskId, type: task.type });

    try {
      this.taskManager.updateTask(taskId, {
        status: 'processing',
        progress: 25
      });

      let result;

      // Process based on task type with timeout handling
      if (task.type === 'policy' || task.type === 'compliance') {
        // Set a longer timeout for AI analysis
        const timeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Analysis timeout')), 180000); // 3 minute timeout
        });

        try {
          // Validate document text before processing
          if (!data.documentText || typeof data.documentText !== 'string') {
            throw new Error('Invalid document text provided');
          }

          // Log the document length for debugging
          log('Processing document', 'info', {
            taskId,
            documentLength: data.documentText.length,
            type: task.type
          });

          // Race between the analysis and timeout
          result = await Promise.race([
            complianceAuditService.analyzeDocument(data.documentText, taskId),
            timeout
          ]);

          if (!result) {
            throw new Error('Analysis produced no results');
          }

          log('Compliance analysis completed', 'info', {
            taskId,
            resultSummaryLength: result?.auditReport?.summary?.length
          });

          // Validate the audit report structure
          validateAuditReport(result);

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

          log(`Task ${taskId} completed successfully with validated audit report`);

        } catch (error: any) {
          log('Analysis error:', 'error', {
            taskId,
            error: error.message,
            stack: error.stack
          });

          if (error.message === 'Analysis timeout') {
            throw new Error('Analysis took too long to complete. Please try again with a shorter document.');
          }

          // Provide more specific error messages
          if (error.message.includes('split')) {
            throw new Error('Error processing document format. Please ensure the document is properly formatted text.');
          }

          throw new Error(`Analysis failed: ${error.message}`);
        }

      } else {
        throw new Error(`Unsupported task type: ${task.type}`);
      }

    } catch (error: any) {
      log(`Error processing task ${taskId}:`, 'error', {
        error: error.message,
        stack: error.stack
      });

      this.taskManager.updateTask(taskId, {
        status: 'error',
        error: error.message,
        errorDetails: error.stack,
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
    log('Fetching audit results', 'info', { taskId });
    const result = this.taskManager.getTaskResult(taskId);

    log('Task result status', 'debug', {
      taskId,
      status: result.status,
      resultKeys: result.data ? Object.keys(result.data) : null
    });

    if (result.status === 'processing') {
      log('Task still processing', 'info', {
        taskId,
        progress: result.progress
      });
    } else if (result.status === 'completed') {
      log('Returning completed task result', 'info', {
        taskId,
        hasAuditReport: !!result.data?.auditReport,
        completedAt: result.completedAt
      });
    } else if (result.status === 'error') {
      log('Returning error task result', 'error', {
        taskId,
        error: result.error,
        details: result.details
      });
    }

    return result;
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