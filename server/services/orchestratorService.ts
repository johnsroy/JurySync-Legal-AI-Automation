import { Anthropic } from "@anthropic-ai/sdk";
import { complianceAuditService } from "./complianceAuditService";
import { legalResearchService } from "./legalResearchService";
import { continuousLearningService } from "./continuousLearningService";
import { documentProcessor } from "./documentProcessor";
import { db } from "../db";
import { legalDocuments } from "@shared/schema";
import { eq } from "drizzle-orm";
import { pdfService } from "./pdf-service";

const HTML_TAG_REGEX = /<[^>]*>|<!DOCTYPE.*?>/i;
const DOCTYPE_REGEX = /<!DOCTYPE\s+[^>]*>|<!doctype\s+[^>]*>/gi;
const INVALID_CHARACTERS_REGEX = /[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g;

// Move initialization logic into a lazy-loaded container
class ServiceContainer {
  private static instance: ServiceContainer;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private anthropicClient: Anthropic | null = null;

  private constructor() {}

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  async getAnthropicClient(): Promise<Anthropic> {
    if (!this.anthropicClient) {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("Missing ANTHROPIC_API_KEY environment variable");
      }
      this.anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
    return this.anthropicClient;
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // Defer all heavy initialization
      setTimeout(async () => {
        try {
          await pdfService.initialize();
          await complianceAuditService.initialize();
          await legalResearchService.initialize();
          await continuousLearningService.initialize();
          this.initialized = true;
        } catch (error) {
          log(
            "Background service initialization error (non-critical)",
            "debug",
            {
              error: error instanceof Error ? error.message : "Unknown error",
            },
          );
        }
      }, 100); // Defer initialization
    })();

    return this.initPromise;
  }
}

// Enhanced logging function
function log(
  message: string,
  type: "info" | "error" | "debug" = "info",
  context?: any,
) {
  const timestamp = new Date().toISOString();
  console.log(
    `[${timestamp}] [Orchestrator] [${type.toUpperCase()}] ${message}`,
    context ? JSON.stringify(context, null, 2) : "",
  );
}

const COMPLIANCE_KEYWORDS = [
  "regulation",
  "compliance",
  "requirements",
  "policy",
  "guidelines",
  "standards",
  "rules",
  "procedures",
  "audit",
  "assessment",
  "control",
  "risk",
  "regulatory",
  "framework",
  "governance",
];

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
      status: "pending",
      progress: 0,
      currentStep: 0,
      currentStepDetails: {
        name: "Initialization",
        description: "Setting up task and validating inputs",
      },
      events: [
        {
          timestamp,
          status: "created",
          details: "Task created and pending analysis",
        },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.tasks.set(taskId, task);
    this.taskHistory.set(taskId, []);
    this.taskResults.set(taskId, null);
    return task;
  }

  updateTask(taskId: string, updates: Partial<any>) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error("Task not found");

    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: Date.now(),
    };

    const history = this.taskHistory.get(taskId) || [];
    history.push({
      timestamp: Date.now(),
      changes: updates,
      previousState: { ...task },
    });

    this.tasks.set(taskId, updatedTask);
    this.taskHistory.set(taskId, history);
    return updatedTask;
  }

  setTaskResult(taskId: string, result: any) {
    this.taskResults.set(taskId, result);
    this.updateTask(taskId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      progress: 100,
    });
  }

  getTaskResult(taskId: string) {
    const result = this.taskResults.get(taskId);
    const task = this.tasks.get(taskId);
    if (!task) {
      return {
        status: "error",
        error: "Task not found",
        details: "The requested task ID does not exist",
      };
    }

    if (task.status === "error") {
      return {
        status: "error",
        error: task.error,
        details: task.errorDetails || "An error occurred during processing",
      };
    }

    if (task.status === "processing") {
      return {
        status: "processing",
        progress: task.progress,
        currentStep: task.currentStep,
        currentStepDetails: task.currentStepDetails,
        message: "Document analysis in progress",
      };
    }

    return {
      status: result ? "completed" : task.status,
      data: result,
      progress: task.progress,
      currentStep: task.currentStep,
      currentStepDetails: task.currentStepDetails,
      error: task.error,
      completedAt: task.completedAt,
    };
  }

  getTask(taskId: string) {
    return this.tasks.get(taskId);
  }

  getAllTasks() {
    return Array.from(this.tasks.values()).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }

  getTaskHistory(taskId: string) {
    return this.taskHistory.get(taskId) || [];
  }
}

export class OrchestratorService {
  private static instance: OrchestratorService;
  private taskManager: TaskManager;
  private services: ServiceContainer;

  private constructor() {
    this.taskManager = TaskManager.getInstance();
    this.services = ServiceContainer.getInstance();
  }

  static getInstance(): OrchestratorService {
    if (!OrchestratorService.instance) {
      OrchestratorService.instance = new OrchestratorService();
    }
    return OrchestratorService.instance;
  }

  async createTask(input: {
    type: "contract" | "compliance" | "research";
    data: any;
  }) {
    const taskId = `task_${Date.now()}`;
    const task = this.taskManager.createTask(taskId, input.type, input.data);

    // Start background initialization
    this.services.initialize().catch(() => {});

    // Start processing in background
    setTimeout(() => {
      this.processTask(task).catch((error) => {
        log("Task processing error", "error", {
          taskId,
          error: error.message,
        });
        this.taskManager.updateTask(taskId, {
          status: "error",
          error: error.message,
          progress: 0,
        });
      });
    }, 0);

    return task;
  }

  private async processTask(task: any) {
    try {
      // Update task to processing state
      this.taskManager.updateTask(task.id, {
        status: "processing",
        progress: 10,
        currentStep: 0,
        currentStepDetails: {
          name: "Document Analysis",
          description: "Analyzing document content and structure",
        },
      });

      // Process based on task type
      switch (task.type) {
        case "contract":
          await this.processContractDocument(task);
          break;
        case "compliance":
          await this.processComplianceDocument(task);
          break;
        case "research":
          await this.processResearchDocument(task);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }
    } catch (error: any) {
      log("Document processing error", "error", {
        taskId: task.id,
        error: error.message,
      });
      throw error;
    }
  }

  private async processContractDocument(task: any) {
    const steps = [
      {
        name: "Draft Generation",
        description: "Generating initial document draft",
        progress: 25,
      },
      {
        name: "Compliance Check",
        description: "Verifying compliance requirements",
        progress: 50,
      },
      {
        name: "Legal Research",
        description: "Conducting legal research and analysis",
        progress: 75,
      },
      {
        name: "Final Review",
        description: "Performing final document review",
        progress: 90,
      },
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      this.taskManager.updateTask(task.id, {
        currentStep: i + 1,
        currentStepDetails: step,
        progress: step.progress,
      });

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const documentData = {
      content: task.data.document,
      title: task.data.filename || "Untitled Document",
      documentType: "contract",
      jurisdiction: "Unknown",
      status: "active",
      metadata: { processedAt: new Date() },
      citations: [],
      vectorId: null,
      date: new Date(),
    };

    // Store document in database
    const [document] = await db
      .insert(legalDocuments)
      .values(documentData)
      .returning();

    // Set final result
    this.taskManager.setTaskResult(task.id, {
      status: "completed",
      documentId: document.id,
      analysis: {
        type: "contract",
        completedSteps: steps.length,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private async processComplianceDocument(task: any) {
    // Reuse contract processing for now
    await this.processContractDocument(task);
  }

  private async processResearchDocument(task: any) {
    // Reuse contract processing for now
    await this.processContractDocument(task);
  }

  async getTask(taskId: string) {
    const memoryTask = this.taskManager.getTask(taskId);
    if (!memoryTask) {
      // Try to find in database
      const dbTask = await this.getTaskFromDatabase(taskId);
      if (dbTask) {
        return {
          ...dbTask,
          status: dbTask.status,
          type: dbTask.documentType,
          data: dbTask.metadata,
        };
      }
      return null;
    }
    return memoryTask;
  }

  async getAllTasks() {
    return this.taskManager.getAllTasks();
  }

  async retryTask(taskId: string) {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    // Reset task status and start processing again
    this.taskManager.updateTask(taskId, {
      status: "pending",
      progress: 0,
      error: undefined,
      currentStep: 0,
      currentStepDetails: {
        name: "Initialization",
        description: "Restarting task processing",
      },
    });

    // Start processing in background
    this.processTask(task).catch((error) => {
      log("Task retry error", "error", {
        taskId,
        error: error.message,
      });

      this.taskManager.updateTask(taskId, {
        status: "error",
        error: error.message,
        progress: 0,
      });
    });

    return task;
  }

  async generateReport(taskId: string): Promise<Buffer> {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    // For now, return a simple Buffer with task details
    // In a real implementation, this would generate a proper PDF report
    const reportContent = JSON.stringify(task, null, 2);
    return Buffer.from(reportContent);
  }

  async getTaskResult(taskId: string) {
    log("Fetching task results", "info", { taskId });
    const result = this.taskManager.getTaskResult(taskId);

    log("Task result status", "debug", {
      taskId,
      status: result.status,
      resultKeys: result.data ? Object.keys(result.data) : null,
    });

    return result;
  }

  async monitorTask(taskId: string) {
    const task = this.taskManager.getTask(taskId);
    if (!task) throw new Error("Task not found");

    return {
      ...task,
      history: this.taskManager.getTaskHistory(taskId),
    };
  }

  private async processDocument(task: any, document: Buffer, fileType: string) {
    try {
      // Initialize services if needed
      await initializeServices();

      let processedContent: string;

      if (fileType.includes("pdf")) {
        try {
          const pdfContent = await pdfService.extractText(document);
          processedContent = pdfContent;
        } catch (error) {
          log("PDF processing fallback to standard processing", "debug", {
            error: error.message,
          });
          processedContent = await documentProcessor
            .processDocument(document, "document.pdf", fileType)
            .then((result) => result.content);
        }
      } else {
        const result = await documentProcessor.processDocument(
          document,
          "document.txt",
          fileType,
        );
        processedContent = result.content;
      }

      return processedContent;
    } catch (error: any) {
      log("Document processing error", "error", {
        taskId: task.id,
        error: error.message,
      });
      throw new Error(`Document processing failed: ${error.message}`);
    }
  }

  private async cleanAndValidateDocument(
    text: string,
    fileType: string = "text/plain",
  ): Promise<string> {
    if (!text) {
      throw new Error("Invalid document text");
    }

    log("Starting document processing", "debug", {
      textLength: text.length,
      fileType,
    });

    try {
      const document = Buffer.from(text);
      return await this.processDocument({ id: "temp" }, document, fileType);
    } catch (error: any) {
      log("Document validation error", "error", { error: error.message });
      throw new Error("Document validation failed");
    }
  }

  async distributeTask(input: {
    type?: "contract" | "compliance" | "research";
    data: any;
  }) {
    const taskId = `task_${Date.now()}`;

    log("Received document processing request", "info", {
      taskId,
      inputType: input.type,
      hasData: !!input.data,
    });

    try {
      if (!input?.data) {
        throw new Error("Request data is required");
      }

      // Clean and validate document text
      const cleanedText = await this.cleanAndValidateDocument(
        input.data.documentText,
      );

      // Create initial task
      const task = this.taskManager.createTask(
        taskId,
        input.type || "unknown",
        {
          ...input.data,
          documentText: cleanedText,
        },
      );

      // Classify document if type not provided
      const classification = await this.classifyDocument(cleanedText);

      // Update task with classification
      this.taskManager.updateTask(taskId, {
        type: classification.type,
        metadata: {
          classification,
          crossModuleRelevance: classification.crossModuleRelevance,
        },
      });

      // Process document based on classification
      await this.processClassifiedDocument(taskId, cleanedText, classification);

      return {
        taskId,
        status: "processing",
        type: classification.type,
        metadata: {
          createdAt: new Date().toISOString(),
          classification,
        },
      };
    } catch (error: any) {
      log("Task distribution error", "error", {
        taskId,
        error: error.message,
      });

      throw {
        error: "Failed to process document",
        details: error.message,
        code: "PROCESSING_ERROR",
        requestId: taskId,
      };
    }
  }

  private async classifyDocument(text: string): Promise<{
    type: "contract" | "compliance" | "research" | "mixed";
    subtypes: string[];
    confidence: number;
    keywords: string[];
    crossModuleRelevance: {
      compliance: boolean;
      contract: boolean;
      research: boolean;
    };
  }> {
    try {
      log("Starting enhanced document classification", "info");

      // Advanced keyword-based pre-classification
      const textLower = text.toLowerCase();
      const matchedKeywords = COMPLIANCE_KEYWORDS.filter((keyword) =>
        textLower.includes(keyword.toLowerCase()),
      );

      // Use Claude for comprehensive classification
      const anthropic = await this.services.getAnthropicClient();
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Analyze this legal document comprehensively and classify it. Consider multiple aspects and possible cross-module relevance.

First 1000 chars: ${text.substring(0, 1000)}

Provide response as JSON:
{
  "type": "contract|compliance|research|mixed",
  "subtypes": ["array of specific document types"],
  "confidence": number between 0-1,
  "reasoning": "brief explanation",
  "crossModuleRelevance": {
    "compliance": boolean,
    "contract": boolean,
    "research": boolean
  },
  "keywords": ["key legal terms found"]
}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response format from Anthropic API");
      }

      const result = JSON.parse(content.text);
      const keywords = [...new Set([...result.keywords, ...matchedKeywords])];

      log("Enhanced document classification completed", "info", {
        classification: result,
        keywordMatches: matchedKeywords,
      });

      return {
        ...result,
        keywords,
      };
    } catch (error: any) {
      log("Document classification failed", "error", { error });
      throw new Error(`Classification failed: ${error.message}`);
    }
  }

  private async processClassifiedDocument(
    taskId: string,
    documentText: string,
    classification: any,
  ) {
    const task = this.taskManager.getTask(taskId);
    if (!task) throw new Error("Task not found");

    try {
      const results: any = {};

      // Process for each relevant module based on classification
      if (classification.crossModuleRelevance.compliance) {
        results.compliance = await complianceAuditService.analyzeDocument(
          documentText,
          taskId,
        );
      }

      if (classification.crossModuleRelevance.research) {
        results.research = await legalResearchService.analyzeDocument(
          task.data.documentId,
        );
      }

      // Get latest continuous learning updates
      const learningContext =
        await continuousLearningService.getLatestUpdates();

      // Store document in database
      const [document] = await db
        .insert(legalDocuments)
        .values({
          title: task.data.title || "Untitled Document",
          content: documentText,
          documentType: classification.type,
          jurisdiction: "Unknown",
          status: "ACTIVE",
          date: new Date(),
          citations: [],
          metadata: {
            classification,
            processingDetails: {
              taskId,
              completedAt: new Date().toISOString(),
              modules: Object.keys(results),
            },
            continuousLearning: {
              contextUpdated: learningContext.lastUpdated,
              updates: learningContext.recentUpdates,
            },
          },
        })
        .returning();

      this.taskManager.setTaskResult(taskId, {
        documentId: document.id,
        results,
        classification,
        continuousLearning: {
          contextUpdated: learningContext.lastUpdated,
          modelUpdates: learningContext.modelUpdates,
          recentUpdates: learningContext.recentUpdates,
        },
      });

      log("Document processing completed", "info", {
        taskId,
        documentId: document.id,
        processedModules: Object.keys(results),
        learningContextUpdated: learningContext.lastUpdated,
      });
    } catch (error: any) {
      log("Error processing document", "error", {
        taskId,
        error: error.message,
      });
      throw error;
    }
  }

  async getTaskFromDatabase(taskId: string) {
    const [task] = await db
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.id, taskId));
    return task;
  }

  async updateTaskStatus(taskId: string, status: string) {
    const [updated] = await db
      .update(legalDocuments)
      .set({ status })
      .where(eq(legalDocuments.id, taskId))
      .returning();
    return updated;
  }
}

export const orchestratorService = OrchestratorService.getInstance();
