import { db } from '../db';
import { documentProcessor } from './documentProcessor';
import { pdfService } from './pdf-service';
import { complianceAuditService } from './complianceAuditService';
import { Anthropic } from '@anthropic-ai/sdk';
import { continuousLearningService } from './continuousLearningService';
import { type DocumentAnalysisRecord, type AnalysisResult } from '@shared/schema';

interface Task {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data: any;
  result?: AnalysisResult;
  error?: string;
}

class TaskManager {
  private tasks: Map<string, Task>;

  constructor() {
    this.tasks = new Map();
  }

  createTask(type: string, data: any): Task {
    const task: Task = {
      id: crypto.randomUUID(),
      type,
      status: 'pending',
      data,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  updateTask(id: string, updates: Partial<Task>): void {
    const task = this.tasks.get(id);
    if (task) {
      Object.assign(task, updates);
    }
  }
}

class ServiceContainer {
  private static instance: ServiceContainer;
  private anthropicClient: Anthropic | null = null;

  private constructor() {}

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  async initialize(): Promise<void> {
    await this.initializeAnthropic();
  }

  private async initializeAnthropic(): Promise<void> {
    if (!this.anthropicClient) {
      this.anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY || '',
      });
    }
  }

  async getAnthropicClient(): Promise<Anthropic> {
    if (!this.anthropicClient) {
      await this.initializeAnthropic();
    }
    if (!this.anthropicClient) {
      throw new Error('Failed to initialize Anthropic client');
    }
    return this.anthropicClient;
  }
}

export class OrchestratorService {
  private static instance: OrchestratorService;
  private taskManager: TaskManager;
  private serviceContainer: ServiceContainer;

  private constructor() {
    this.taskManager = new TaskManager();
    this.serviceContainer = ServiceContainer.getInstance();
  }

  static getInstance(): OrchestratorService {
    if (!OrchestratorService.instance) {
      OrchestratorService.instance = new OrchestratorService();
    }
    return OrchestratorService.instance;
  }

  async createTask(params: { type: string; data: any }): Promise<Task> {
    const task = this.taskManager.createTask(params.type, params.data);
    this.processTask(task).catch(console.error);
    return task;
  }

  private async processTask(task: Task): Promise<void> {
    try {
      this.taskManager.updateTask(task.id, { status: 'processing' });

      const { documentId } = task.data;
      const document = await db.query.documents.findFirst({
        where: (documents, { eq }) => eq(documents.id, documentId)
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // Process the document based on task type
      switch (task.type) {
        case 'compliance':
          await this.runComplianceAnalysis(task, document);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      this.taskManager.updateTask(task.id, { status: 'completed' });
    } catch (error: any) {
      console.error(`Task processing error:`, error);
      this.taskManager.updateTask(task.id, {
        status: 'failed',
        error: error.message
      });
    }
  }

  private async runComplianceAnalysis(task: Task, document: DocumentAnalysisRecord): Promise<void> {
    const analysis = await complianceAuditService.analyzeDocument(document.content);

    // Update task with results
    this.taskManager.updateTask(task.id, {
      result: {
        documentType: analysis.documentType,
        documentDescription: analysis.description,
        industry: analysis.industry,
        industryDescription: analysis.industryDetails,
        status: analysis.complianceStatus,
        statusDescription: analysis.complianceDetails,
        aiAnalysis: {
          summary: analysis.summary,
          analysis: {
            legalPrinciples: analysis.legalPrinciples,
            keyPrecedents: analysis.keyPrecedents,
            recommendations: analysis.recommendations
          },
          citations: analysis.citations
        }
      }
    });

    // Store analysis in database
    await db.insert(documentAnalysis).values({
      documentId: document.id,
      documentType: analysis.documentType,
      industry: analysis.industry,
      complianceStatus: {
        status: analysis.complianceStatus,
        details: analysis.complianceDetails,
        lastChecked: new Date().toISOString()
      },
      aiAnalysis: {
        summary: analysis.summary,
        analysis: {
          legalPrinciples: analysis.legalPrinciples,
          keyPrecedents: analysis.keyPrecedents,
          recommendations: analysis.recommendations
        },
        citations: analysis.citations
      }
    });
  }
}

export const orchestratorService = OrchestratorService.getInstance();