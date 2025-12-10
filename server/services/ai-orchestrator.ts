import { OpenAI } from "openai";
import { z } from "zod";
import debug from "debug";
import { metricsCollector } from "./metricsCollector";

const log = debug("app:ai-orchestrator");

// Type definitions for document analysis
interface DocumentAnalysisResult {
  documentType: string;
  keyClauses: string[];
  partiesInvolved: string[];
  potentialRisks: string[];
  summary?: string;
}

interface ComplianceCheckResult {
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
  identifiedIssues: string[];
  riskLevels: Record<string, string>;
  recommendedActions: string[];
}

interface EnhancedDraftResult {
  originalStructure: string;
  improvements: string[];
  enhancedContent: string;
  bestPracticesApplied: string[];
}

interface ApprovalStatus {
  success: boolean;
  status: string;
  approvers: string[];
  timestamp: string;
}

interface AuditReportResult {
  processSummary: string;
  keyChangesMade: string[];
  riskAssessment: string;
  recommendations: string[];
}

interface ProcessingResult {
  success: boolean;
  result?: {
    documentAnalysis: DocumentAnalysisResult;
    complianceChecks: ComplianceCheckResult;
    enhancedDraft: EnhancedDraftResult;
    approvalStatus: ApprovalStatus;
    auditReport: AuditReportResult;
  };
  error?: string;
}

export class AIOrchestrator {
  private openai: OpenAI;
  private initialized: boolean = false;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private readonly INIT_TIMEOUT = 10000; // 10 seconds
  private gptModel: string = "";

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: this.INIT_TIMEOUT,
    });
  }

  private async ensureInitialized() {
    if (this.initialized) return;

    try {
      log("Initializing AI Orchestrator...");
      const models = await Promise.race([
        this.openai.models.list(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("OpenAI API connection timeout")), this.INIT_TIMEOUT)
        )
      ]);

      // Check for any GPT-4 model variant
      const hasGpt4Model = models.data.some(m => 
        m.id.includes("gpt-4") || 
        m.id.includes("gpt-4o") || 
        m.id.includes("gpt-4-turbo")
      );
      
      if (!hasGpt4Model) {
        throw new Error("No GPT-4 model variant is available");
      }

      // Determine best available model
      this.gptModel = models.data.find(m => m.id === "gpt-4-1106-preview")?.id || 
                     models.data.find(m => m.id === "gpt-4o")?.id ||
                     models.data.find(m => m.id.includes("gpt-4"))?.id ||
                     "gpt-3.5-turbo";
      
      log(`Using model: ${this.gptModel}`);
      this.initialized = true;
      log("AI Orchestrator initialized successfully");
    } catch (error) {
      log("Failed to initialize AI Orchestrator:", error);
      throw new Error(`AI initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processDocument(content: string, type: "upload" | "paste"): Promise<ProcessingResult> {
    try {
      await this.ensureInitialized();

      if (!content || content.trim().length === 0) {
        throw new Error("Document content cannot be empty");
      }

      log("Starting document processing");

      // Stage 1: Document Analysis
      log("Starting document analysis...");
      const documentAnalysis = await this.analyzeDocument(content);
      log("Document analysis completed", {
        analysisKeys: Object.keys(documentAnalysis)
      });

      // Stage 2: Compliance Check
      log("Starting compliance check...");
      const complianceChecks = await this.checkCompliance(content);
      log("Compliance check completed", {
        checkKeys: Object.keys(complianceChecks)
      });

      // Stage 3: Generate Enhanced Draft
      log("Starting draft generation...");
      const enhancedDraft = await this.generateDraftWithRetry(content, documentAnalysis);
      log("Draft generation completed", {
        draftKeys: Object.keys(enhancedDraft)
      });

      // Stage 4: Approval Process
      const approvalStatus = {
        success: true,
        status: "approved",
        approvers: ["system"],
        timestamp: new Date().toISOString()
      };

      // Stage 5: Audit Report
      log("Generating audit report...");
      const auditReport = await this.generateAuditReport({
        documentAnalysis,
        complianceChecks,
        enhancedDraft,
        approvalStatus
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
      const errorMessage = error instanceof Error ? error.message : "Unknown error during processing";
      log("Error details:", errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  private async analyzeDocument(content: string): Promise<DocumentAnalysisResult> {
    try {
      log("Calling OpenAI API for document analysis...");
      const response = await this.openai.chat.completions.create({
        model: this.gptModel,
        messages: [
          {
            role: "system",
            content: `You are a legal document analyzer. Analyze the provided document and extract key information in JSON format.
            Return a JSON object with the following structure:
            {
              "documentType": "type of document",
              "keyClauses": ["array of key clauses"],
              "partiesInvolved": ["array of parties"],
              "potentialRisks": ["array of risks"],
              "summary": "brief summary of the document"
            }`
          },
          {
            role: "user",
            content
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const messageContent = response.choices[0]?.message?.content;
      if (!messageContent) {
        throw new Error("Empty response from OpenAI API");
      }

      const result = JSON.parse(messageContent);

      // Validate and normalize the result
      const validatedResult: DocumentAnalysisResult = {
        documentType: result.documentType || "Unknown",
        keyClauses: Array.isArray(result.keyClauses) ? result.keyClauses : [],
        partiesInvolved: Array.isArray(result.partiesInvolved) ? result.partiesInvolved : [],
        potentialRisks: Array.isArray(result.potentialRisks) ? result.potentialRisks : [],
        summary: result.summary || ""
      };

      log("Document analysis completed successfully");
      return validatedResult;
    } catch (error) {
      log("Document analysis failed:", error);
      throw new Error(`Document analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkCompliance(content: string): Promise<ComplianceCheckResult> {
    try {
      log("Calling OpenAI API for compliance check...");
      const response = await this.openai.chat.completions.create({
        model: this.gptModel,
        messages: [
          {
            role: "system",
            content: `You are a legal compliance checker. Review the document for compliance issues and return results in JSON format.
            Return a JSON object with the following structure:
            {
              "complianceStatus": "COMPLIANT" | "NON_COMPLIANT" | "NEEDS_REVIEW",
              "identifiedIssues": ["array of issues found"],
              "riskLevels": { "category": "HIGH" | "MEDIUM" | "LOW" },
              "recommendedActions": ["array of recommended actions"]
            }`
          },
          {
            role: "user",
            content
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      });

      const messageContent = response.choices[0]?.message?.content;
      if (!messageContent) {
        throw new Error("Empty response from OpenAI API");
      }

      const result = JSON.parse(messageContent);

      // Validate and normalize the result
      const validatedResult: ComplianceCheckResult = {
        complianceStatus: this.validateComplianceStatus(result.complianceStatus),
        identifiedIssues: Array.isArray(result.identifiedIssues) ? result.identifiedIssues : [],
        riskLevels: typeof result.riskLevels === 'object' ? result.riskLevels : {},
        recommendedActions: Array.isArray(result.recommendedActions) ? result.recommendedActions : []
      };

      log("Compliance check completed successfully");
      return validatedResult;
    } catch (error) {
      log("Compliance check failed:", error);
      throw new Error(`Compliance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateComplianceStatus(status: string): 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW' {
    const validStatuses = ['COMPLIANT', 'NON_COMPLIANT', 'NEEDS_REVIEW'];
    if (validStatuses.includes(status)) {
      return status as 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
    }
    return 'NEEDS_REVIEW';
  }

  private async generateDraftWithRetry(content: string, analysis: DocumentAnalysisResult, retries = this.MAX_RETRIES): Promise<EnhancedDraftResult> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        log(`Attempting draft generation (attempt ${attempt} of ${retries})...`);
        
        // Truncate content if too large
        const MAX_CONTENT_LENGTH = 12000;
        let truncatedContent = content;
        if (content.length > MAX_CONTENT_LENGTH) {
          truncatedContent = content.substring(0, MAX_CONTENT_LENGTH) + 
            `\n\n[Content truncated. Original length: ${content.length} characters]`;
          log(`Content truncated from ${content.length} to ${truncatedContent.length} characters`);
        }
        
        const response = await this.openai.chat.completions.create({
          model: this.gptModel,
          messages: [
            {
              role: "system",
              content: `You are a legal document drafter. Generate an enhanced version of the document in JSON format.
              Return a JSON object with the following structure:
              {
                "originalStructure": "description of original structure",
                "improvements": ["array of improvements made"],
                "enhancedContent": "the enhanced document content",
                "bestPracticesApplied": ["array of best practices applied"]
              }`
            },
            {
              role: "user",
              content: `Original content: ${truncatedContent}\nAnalysis: ${JSON.stringify(analysis)}`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.4
        });

        const messageContent = response.choices[0]?.message?.content;
        if (!messageContent) {
          throw new Error("Empty response from OpenAI API");
        }

        const result = JSON.parse(messageContent);

        // Validate and normalize the result
        const validatedResult: EnhancedDraftResult = {
          originalStructure: result.originalStructure || "",
          improvements: Array.isArray(result.improvements) ? result.improvements : [],
          enhancedContent: result.enhancedContent || result.content || "",
          bestPracticesApplied: Array.isArray(result.bestPracticesApplied) ? result.bestPracticesApplied : []
        };

        log("Draft generation completed successfully");
        return validatedResult;
      } catch (error) {
        log(`Draft generation attempt ${attempt} failed:`, error);
        if (attempt === retries) {
          throw new Error(`Draft generation failed after ${retries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt));
      }
    }
  }

  private async generateAuditReport(data: {
    documentAnalysis: DocumentAnalysisResult;
    complianceChecks: ComplianceCheckResult;
    enhancedDraft: EnhancedDraftResult;
    approvalStatus: ApprovalStatus;
  }): Promise<AuditReportResult> {
    try {
      log("Calling OpenAI API for audit report generation...");
      const response = await this.openai.chat.completions.create({
        model: this.gptModel,
        messages: [
          {
            role: "system",
            content: `You are a legal document auditor. Generate an audit report in JSON format.
            Return a JSON object with the following structure:
            {
              "processSummary": "summary of the processing workflow",
              "keyChangesMade": ["array of key changes"],
              "riskAssessment": "overall risk assessment",
              "recommendations": ["array of recommendations"]
            }`
          },
          {
            role: "user",
            content: JSON.stringify(data)
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      });

      const messageContent = response.choices[0]?.message?.content;
      if (!messageContent) {
        throw new Error("Empty response from OpenAI API");
      }

      const result = JSON.parse(messageContent);

      // Validate and normalize the result
      const validatedResult: AuditReportResult = {
        processSummary: result.processSummary || "Document processing completed",
        keyChangesMade: Array.isArray(result.keyChangesMade) ? result.keyChangesMade : [],
        riskAssessment: result.riskAssessment || "Assessment pending review",
        recommendations: Array.isArray(result.recommendations) ? result.recommendations : []
      };

      log("Audit report generation completed successfully");
      return validatedResult;
    } catch (error) {
      log("Audit report generation failed:", error);
      throw new Error(`Audit report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const aiOrchestrator = new AIOrchestrator();