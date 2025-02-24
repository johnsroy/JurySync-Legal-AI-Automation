import { OpenAI } from "openai";
import { DocumentProcessor } from "./document-processor";
import { ComplianceChecker } from "./compliance-checker";
import { DraftGenerator } from "./draft-generator";
import { AuditAgent } from "./audit-agent";
import { metricsCollector } from "./metricsCollector";

export class AIOrchestrator {
  private openai: OpenAI;
  private documentProcessor: DocumentProcessor;
  private complianceChecker: ComplianceChecker;
  private draftGenerator: DraftGenerator;
  private auditAgent: AuditAgent;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.documentProcessor = new DocumentProcessor(this.openai);
    this.complianceChecker = new ComplianceChecker(this.openai);
    this.draftGenerator = new DraftGenerator(this.openai);
    this.auditAgent = new AuditAgent(this.openai);
  }

  async processDocument(content: string, type: "upload" | "paste") {
    const startTime = new Date();
    const workflowId = crypto.randomUUID();

    try {
      // Stage 1: Document Analysis & Draft Generation
      const processedDoc = await this.documentProcessor.process(content, type);
      if (!processedDoc.success) {
        throw new Error(processedDoc.error);
      }

      // Stage 2: Compliance Check
      const complianceResult = await this.complianceChecker.check(
        processedDoc.content,
      );
      if (!complianceResult.success) {
        throw new Error(complianceResult.error);
      }

      // Stage 3: Generate Enhanced Draft
      const draft = await this.draftGenerator.generate(
        processedDoc.content,
        complianceResult.requirements,
      );
      if (!draft.success) {
        throw new Error(draft.error);
      }

      // Stage 4: Approval Process
      const approvalResult = await this.processApproval(draft.content);
      if (!approvalResult.success) {
        throw new Error(approvalResult.error);
      }

      // Stage 5: Final Audit
      const auditResult = await this.auditAgent.audit({
        originalContent: processedDoc.content,
        finalDraft: draft.content,
        complianceChecks: complianceResult,
        approvalDetails: approvalResult,
      });

      // Record metrics
      await metricsCollector.recordWorkflowMetric({
        workflowId,
        workflowType: "document_processing",
        startTime,
        completionTime: new Date(),
        successful: true,
        metadata: {
          documentType: type,
          stepsCompleted: [
            "analysis",
            "compliance",
            "draft",
            "approval",
            "audit",
          ],
        },
      });

      return {
        success: true,
        result: {
          documentAnalysis: processedDoc.analysis,
          complianceChecks: complianceResult.requirements,
          enhancedDraft: draft.content,
          approvalStatus: approvalResult,
          auditReport: auditResult,
        },
      };
    } catch (error) {
      // Record failure metrics
      await metricsCollector.recordWorkflowMetric({
        workflowId,
        workflowType: "document_processing",
        startTime,
        completionTime: new Date(),
        successful: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  }

  private async processApproval(content: string) {
    // Implement approval workflow logic here
    return {
      success: true,
      status: "approved",
      approvers: ["system"],
      timestamp: new Date().toISOString(),
    };
  }
}
