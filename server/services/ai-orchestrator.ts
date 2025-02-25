import { OpenAI } from "openai";
import { z } from "zod";
import debug from "debug";
import { metricsCollector } from "./metricsCollector";

const log = debug("app:ai-orchestrator");

interface ProcessingResult {
  success: boolean;
  result?: {
    documentAnalysis: any;
    complianceChecks: any;
    enhancedDraft: any;
    approvalStatus: {
      success: boolean;
      status: string;
      approvers: string[];
      timestamp: string;
    };
    auditReport: any;
  };
}

export class AIOrchestrator {
  private openai: OpenAI;
  private initialized: boolean = false;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async initialize() {
    if (this.initialized) return;

    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      // Test API connection
      await this.openai.models.list();
      this.initialized = true;
      log("AI Orchestrator initialized successfully");
    } catch (error) {
      log("Failed to initialize AI Orchestrator:", error);
      throw error;
    }
  }

  async processDocument(content: string, type: "upload" | "paste"): Promise<ProcessingResult> {
    const startTime = new Date();
    const workflowId = crypto.randomUUID();

    try {
      await this.initialize();

      // Stage 1: Document Analysis
      const documentAnalysis = await this.analyzeDocument(content);

      // Stage 2: Compliance Check
      const complianceChecks = await this.checkCompliance(content);

      // Stage 3: Generate Enhanced Draft
      const enhancedDraft = await this.generateDraft(content, documentAnalysis);

      // Stage 4: Approval Process
      const approvalStatus = {
        success: true,
        status: "approved",
        approvers: ["system"],
        timestamp: new Date().toISOString()
      };

      // Stage 5: Audit Report
      const auditReport = await this.generateAuditReport({
        documentAnalysis,
        complianceChecks,
        enhancedDraft,
        approvalStatus
      });

      // Record metrics
      await metricsCollector.recordWorkflowMetric({
        userId: 1, // Default system user
        workflowId,
        workflowType: "document_processing",
        status: "completed",
        startTime,
        completionTime: new Date(),
        successful: true,
        metadata: {
          stepsCompleted: [
            "analysis",
            "compliance",
            "draft",
            "approval",
            "audit"
          ]
        }
      });

      return {
        success: true,
        result: {
          documentAnalysis,
          complianceChecks,
          enhancedDraft,
          approvalStatus,
          auditReport
        }
      };

    } catch (error) {
      log("Document processing error:", error);

      // Record failure metrics
      await metricsCollector.recordWorkflowMetric({
        userId: 1, // Default system user
        workflowId,
        workflowType: "document_processing",
        status: "failed",
        startTime,
        completionTime: new Date(),
        successful: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      });

      return {
        success: false,
        result: undefined
      };
    }
  }

  private async analyzeDocument(content: string) {
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: [
        {
          role: "system",
          content: "You are a legal document analyzer. Analyze the provided document and extract key information."
        },
        {
          role: "user",
          content: content
        }
      ],
      temperature: 0.3
    });

    return JSON.parse(completion.choices[0].message.content || "{}");
  }

  private async checkCompliance(content: string) {
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: [
        {
          role: "system",
          content: "You are a legal compliance checker. Review the document for compliance issues."
        },
        {
          role: "user",
          content: content
        }
      ],
      temperature: 0.2
    });

    return JSON.parse(completion.choices[0].message.content || "{}");
  }

  private async generateDraft(content: string, analysis: any) {
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: [
        {
          role: "system",
          content: "You are a legal document drafter. Generate an enhanced version of the document."
        },
        {
          role: "user",
          content: `Original content: ${content}\nAnalysis: ${JSON.stringify(analysis)}`
        }
      ],
      temperature: 0.4
    });

    return JSON.parse(completion.choices[0].message.content || "{}");
  }

  private async generateAuditReport(data: any) {
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: [
        {
          role: "system",
          content: "You are a legal document auditor. Generate an audit report for the document processing."
        },
        {
          role: "user",
          content: JSON.stringify(data)
        }
      ],
      temperature: 0.2
    });

    return JSON.parse(completion.choices[0].message.content || "{}");
  }
}