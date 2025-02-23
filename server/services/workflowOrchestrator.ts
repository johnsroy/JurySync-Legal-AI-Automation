import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { Client } from "langsmith";
import { z } from "zod";
import debug from 'debug';
import { db } from "../db";
import { vaultDocuments } from "@shared/schema";
import { eq } from "drizzle-orm";

// Workflow stage types
type WorkflowStage = 'draft' | 'review' | 'approval' | 'signature' | 'audit';

// Error types for different failure scenarios
enum WorkflowErrorType {
  API_TIMEOUT = 'API_TIMEOUT',
  MISSING_DATA = 'MISSING_DATA',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  ROUTING_ERROR = 'ROUTING_ERROR',
  UNKNOWN = 'UNKNOWN',
  TOKEN_LIMIT = 'TOKEN_LIMIT',
  API_ERROR = 'API_ERROR',
  PARSING_ERROR = 'PARSING_ERROR'
}

interface WorkflowError {
  type: WorkflowErrorType;
  message: string;
  timestamp: Date;
  retryCount: number;
}

// Simulated e-signature service response
interface SignatureResponse {
  signatureId: string;
  status: 'pending' | 'completed' | 'failed';
  signers: Array<{
    email: string;
    status: 'pending' | 'signed';
  }>;
}

// Version history schema
const versionSchema = z.object({
  id: z.number(),
  contractId: z.number(),
  version: z.number(),
  content: z.string(),
  status: z.enum(['draft', 'review', 'approved', 'rejected']),
  timestamp: z.date(),
  author: z.string(),
  changes: z.string(),
});

export type Version = z.infer<typeof versionSchema>;

const log = debug('jurysync:workflow-orchestrator');

// Initialize LangSmith client for tracking and evaluation
const client = new Client({
  apiUrl: process.env.LANGCHAIN_ENDPOINT || "https://api.smith.langchain.com",
  apiKey: process.env.LANGCHAIN_API_KEY,
});

// Initialize AI model with higher context limits
const chatModel = new ChatOpenAI({
  modelName: "gpt-4-0125-preview",
  maxTokens: 4096,
  temperature: 0.2
});

// Document state schema
const DocumentState = z.object({
  id: z.number(),
  content: z.string(),
  analysis: z.object({
    documentType: z.string(),
    summary: z.string(),
    keyPoints: z.array(z.string()),
    entities: z.array(z.string()),
    confidence: z.number(),
    status: z.enum(['pending', 'in_progress', 'completed', 'failed'])
  }),
  metadata: z.record(z.any())
});

type DocumentStateType = z.infer<typeof DocumentState>;

// Analysis agents
const documentTypeAgent = RunnableSequence.from([
  PromptTemplate.fromTemplate(`
    Analyze this document and determine its type and purpose.
    Document content: {content}

    Return a JSON object with:
    - documentType: The specific type of legal document
    - confidence: Confidence score (0-1)
    - purpose: Brief description of document purpose
  `),
  chatModel,
  new StringOutputParser()
]);

const entityExtractionAgent = RunnableSequence.from([
  PromptTemplate.fromTemplate(`
    Extract key entities and information from this document.
    Document content: {content}

    Return a JSON object with:
    - entities: Array of important entities (people, organizations, dates)
    - keyPoints: Array of main points or clauses
    - relationships: Key relationships between entities
  `),
  chatModel,
  new StringOutputParser()
]);

const summaryAgent = RunnableSequence.from([
  PromptTemplate.fromTemplate(`
    Provide a comprehensive summary of this legal document.
    Document content: {content}
    Document type: {documentType}

    Return a JSON object with:
    - summary: Executive summary of the document
    - recommendations: Key considerations or actions needed
    - risks: Potential risks or issues identified
  `),
  chatModel,
  new StringOutputParser()
]);

class WorkflowOrchestrator {
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // ms

  async initiateSignature(contractId: number) {
    try {
      console.log(`Initiating e-signature process for contract ${contractId}`);

      // Log workflow stage entry
      await this.logWorkflowEvent(contractId, 'signature_initiated', {
        stage: 'signature',
        timestamp: new Date()
      });

      // Simulate e-signature API call
      const signatureResponse: SignatureResponse = await this.retryOperation(
        async () => ({
          signatureId: `sig-${Date.now()}`,
          status: 'pending',
          signers: [
            { email: 'signer1@example.com', status: 'pending' },
            { email: 'signer2@example.com', status: 'pending' }
          ]
        }),
        'E-signature API call'
      );

      // Log the signature request
      await this.logWorkflowEvent(contractId, 'signature_initiated', {
        signatureId: signatureResponse.signatureId,
        signers: signatureResponse.signers
      });

      return {
        signatureId: signatureResponse.signatureId,
        status: signatureResponse.status,
        message: 'E-signature process initiated successfully'
      };
    } catch (error) {
      const workflowError = this.handleError(error, 'signature');
      await this.logWorkflowEvent(contractId, 'signature_error', workflowError);
      throw new Error('Failed to initiate e-signature process');
    }
  }

  async initiateReview(contractId: number) {
    try {
      console.log(`Initiating review process for contract ${contractId}`);

      await this.logWorkflowEvent(contractId, 'review_initiated', {
        stage: 'review',
        timestamp: new Date()
      });

      // Create a new version for review
      const newVersion = await this.createVersion(contractId, {
        status: 'review',
        author: 'System',
        changes: 'Submitted for internal review'
      });

      // Log the review initiation
      await this.logWorkflowEvent(contractId, 'review_initiated', {
        versionId: newVersion.id,
        timestamp: new Date()
      });

      return {
        versionId: newVersion.id,
        status: 'review',
        message: 'Internal review process initiated successfully'
      };
    } catch (error) {
      const workflowError = this.handleError(error, 'review');
      await this.logWorkflowEvent(contractId, 'review_error', workflowError);
      throw new Error('Failed to initiate review process');
    }
  }

  async getVersionHistory(contractId: number): Promise<Version[]> {
    try {
      console.log(`Fetching version history for contract ${contractId}`);

      const versions = await db.query(
        'SELECT * FROM contract_versions WHERE contract_id = $1 ORDER BY version DESC',
        [contractId]
      );

      return versions.rows.map(row => versionSchema.parse(row));
    } catch (error) {
      const workflowError = this.handleError(error, 'version_history');
      await this.logWorkflowEvent(contractId, 'version_history_error', workflowError);
      throw new Error('Failed to fetch version history');
    }
  }

  async processDocument(documentId: number): Promise<DocumentStateType> {
    try {
      // Start LangSmith run tracking
      const run = await client.createRun({
        name: "Document Analysis Workflow",
        run_type: "chain",
        inputs: { documentId: documentId.toString() }
      });

      try {
        // Get document from database
        const [document] = await db
          .select()
          .from(vaultDocuments)
          .where(eq(vaultDocuments.id, documentId));

        if (!document) {
          throw new Error(`Document not found: ${documentId}`);
        }

        // Initialize document state
        let state: DocumentStateType = {
          id: document.id,
          content: document.content,
          analysis: {
            documentType: '',
            summary: '',
            keyPoints: [],
            entities: [],
            confidence: 0,
            status: 'pending'
          },
          metadata: {}
        };

        // Document type analysis
        log('Running document type analysis');
        const typeAnalysis = await this.runWithRetry(
          () => documentTypeAgent.invoke({ content: document.content }),
          'Document type analysis'
        );
        const typeResult = JSON.parse(typeAnalysis);

        state.analysis.documentType = typeResult.documentType;
        state.analysis.confidence = typeResult.confidence;
        state.metadata.purpose = typeResult.purpose;
        state.analysis.status = 'in_progress';

        // Entity extraction
        log('Running entity extraction');
        const entityAnalysis = await this.runWithRetry(
          () => entityExtractionAgent.invoke({ content: document.content }),
          'Entity extraction'
        );
        const entityResult = JSON.parse(entityAnalysis);

        state.analysis.entities = entityResult.entities;
        state.analysis.keyPoints = entityResult.keyPoints;
        state.metadata.relationships = entityResult.relationships;

        // Document summary
        log('Generating document summary');
        const summaryAnalysis = await this.runWithRetry(
          () => summaryAgent.invoke({ 
            content: document.content,
            documentType: state.analysis.documentType
          }),
          'Document summary'
        );
        const summaryResult = JSON.parse(summaryAnalysis);

        state.analysis.summary = summaryResult.summary;
        state.metadata.recommendations = summaryResult.recommendations;
        state.metadata.risks = summaryResult.risks;
        state.analysis.status = 'completed';

        // Update run with success
        await client.updateRun({
          runId: run.id,
          outputs: state,
          endTime: new Date().toISOString()
        });

        // Update document in database
        await db.update(vaultDocuments)
          .set({ 
            documentType: state.analysis.documentType,
            metadata: state.metadata,
            status: 'completed'
          })
          .where(eq(vaultDocuments.id, documentId));

        return state;

      } catch (error) {
        // Update run with error
        await client.updateRun({
          runId: run.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          endTime: new Date().toISOString()
        });

        // Update document status
        await db.update(vaultDocuments)
          .set({ status: 'failed' })
          .where(eq(vaultDocuments.id, documentId));

        throw error;
      }

    } catch (error) {
      log('Workflow error:', error);
      throw error;
    }
  }

  async getDiagnosticReport(documentId: number) {
    try {
      // Get runs from LangSmith for this document
      const runs = await client.listRuns({
        filter: {
          inputs: { documentId: documentId.toString() }
        }
      });

      const diagnosticReport = {
        documentId,
        totalRuns: runs.length,
        successfulRuns: runs.filter(r => r.status === 'completed').length,
        failedRuns: runs.filter(r => r.status === 'failed').length,
        averageRuntime: runs.reduce((acc, run) => acc + (run.endTime - run.startTime), 0) / runs.length,
        errorTypes: this.aggregateErrorTypes(runs),
        recommendations: this.generateRecommendations(runs)
      };

      return {
        success: true,
        report: diagnosticReport
      };
    } catch (error) {
      log('Failed to generate diagnostic report:', error);
      throw new Error('Failed to generate diagnostic report');
    }
  }


  private async createVersion(contractId: number, {
    status,
    author,
    changes
  }: {
    status: Version['status'],
    author: string,
    changes: string
  }): Promise<Version> {
    try {
      // Get the latest version number
      const result = await db.query(
        'SELECT MAX(version) as max_version FROM contract_versions WHERE contract_id = $1',
        [contractId]
      );
      const nextVersion = (result.rows[0].max_version || 0) + 1;

      // Insert new version
      const [newVersion] = await db.query(
        `INSERT INTO contract_versions 
         (contract_id, version, status, author, changes, timestamp) 
         VALUES ($1, $2, $3, $4, $5, NOW()) 
         RETURNING *`,
        [contractId, nextVersion, status, author, changes]
      );

      return versionSchema.parse(newVersion);
    } catch (error) {
      console.error('Failed to create version:', error);
      throw new Error('Failed to create new version');
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryCount = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        console.log(`Retrying ${operationName} (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        return this.retryOperation(operation, operationName, retryCount + 1);
      }
      throw error;
    }
  }

  private handleError(error: unknown, stage: string): WorkflowError {
    const timestamp = new Date();

    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return {
          type: WorkflowErrorType.API_TIMEOUT,
          message: `Timeout in ${stage} stage: ${error.message}`,
          timestamp,
          retryCount: 0
        };
      }
      if (error.message.includes('validation')) {
        return {
          type: WorkflowErrorType.VALIDATION_ERROR,
          message: `Validation error in ${stage} stage: ${error.message}`,
          timestamp,
          retryCount: 0
        };
      }
      if (error.message.includes('token limit exceeded')){
        return {
          type: WorkflowErrorType.TOKEN_LIMIT,
          message: `Token limit exceeded in ${stage} stage: ${error.message}`,
          timestamp,
          retryCount: 0
        };
      }
      if (error.message.includes('API error')){
        return {
          type: WorkflowErrorType.API_ERROR,
          message: `API error in ${stage} stage: ${error.message}`,
          timestamp,
          retryCount: 0
        };
      }
      if (error.message.includes('parsing error')){
        return {
          type: WorkflowErrorType.PARSING_ERROR,
          message: `Parsing error in ${stage} stage: ${error.message}`,
          timestamp,
          retryCount: 0
        };
      }

    }

    return {
      type: WorkflowErrorType.UNKNOWN,
      message: `Unknown error in ${stage} stage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp,
      retryCount: 0
    };
  }

  private async logWorkflowEvent(
    contractId: number,
    eventType: string,
    details: Record<string, any>
  ) {
    try {
      await db.query(
        `INSERT INTO workflow_events 
         (contract_id, event_type, details, timestamp) 
         VALUES ($1, $2, $3, NOW())`,
        [contractId, eventType, JSON.stringify(details)]
      );
    } catch (error) {
      console.error('Failed to log workflow event:', error);
      // Don't throw here to prevent workflow interruption
    }
  }

  private aggregateErrorTypes(runs: any[]) {
    const errorTypes = new Map<string, number>();

    runs.filter(r => r.status === 'failed').forEach(run => {
      const errorType = run.error?.type || 'UNKNOWN';
      errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
    });

    return Object.fromEntries(errorTypes);
  }

  private generateRecommendations(runs: any[]) {
    const recommendations: string[] = [];
    const errorCounts = this.aggregateErrorTypes(runs);

    Object.entries(errorCounts).forEach(([type, count]) => {
      if (count > 3) {
        switch (type) {
          case 'TOKEN_LIMIT':
            recommendations.push('Consider breaking down large documents into smaller chunks');
            break;
          case 'API_ERROR':
            recommendations.push('Review API rate limits and implement better throttling');
            break;
          case 'PARSING_ERROR':
            recommendations.push('Improve document preprocessing and cleaning steps');
            break;
          case 'API_TIMEOUT':
            recommendations.push('Consider increasing API timeout limits or implementing circuit breakers');
            break;
          case 'VALIDATION_ERROR':
            recommendations.push('Review input validation rules and data preprocessing steps');
            break;
          case 'ROUTING_ERROR':
            recommendations.push('Check workflow routing configuration and service availability');
            break;
        }
      }
    });

    return recommendations;
  }

  private runWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryCount = 0
  ): Promise<T> {
    try {
      return operation();
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        log(`Retrying ${operationName} (attempt ${retryCount + 1})`);
        setTimeout(() => {}, this.RETRY_DELAY);
        return this.runWithRetry(operation, operationName, retryCount + 1);
      }
      throw error;
    }
  }
}

export const workflowOrchestrator = new WorkflowOrchestrator();