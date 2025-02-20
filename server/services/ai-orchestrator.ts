import { OpenAI } from 'openai';
import { DocumentProcessor } from './document-processor';
import { ComplianceChecker } from './compliance-checker';
import { DraftGenerator } from './draft-generator';
import { AuditAgent } from './audit-agent';

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

  async processDocument(content: string, type: 'upload' | 'paste') {
    try {
      // Step 1: Process and validate document
      const processedDoc = await this.documentProcessor.process(content, type);
      if (!processedDoc.success) {
        throw new Error(processedDoc.error);
      }

      // Step 2: Check compliance
      const complianceResult = await this.complianceChecker.check(processedDoc.content);
      if (!complianceResult.success) {
        throw new Error(complianceResult.error);
      }

      // Step 3: Generate draft
      const draft = await this.draftGenerator.generate(processedDoc.content, complianceResult.requirements);
      if (!draft.success) {
        throw new Error(draft.error);
      }

      // Step 4: Final audit
      const auditResult = await this.auditAgent.audit(draft.content);

      return {
        success: true,
        result: {
          processedDocument: processedDoc.content,
          complianceChecks: complianceResult.requirements,
          draft: draft.content,
          auditReport: auditResult
        }
      };
    } catch (error) {
      console.error('AI Orchestration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI processing failed'
      };
    }
  }
} 