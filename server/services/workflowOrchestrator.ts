// Move SignatureResponse interface to top level
interface SignatureResponse {
  signatureId: string;
  status: 'pending' | 'completed' | 'failed';
  signers: Array<{
    email: string;
    status: 'pending' | 'signed';
  }>;
}

import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { Client } from "langsmith";
import { z } from "zod";
import debug from 'debug';
import { db } from "../db";
import { vaultDocuments, contractVersions, workflowEvents } from "@shared/schema";
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
const client = new Client();

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

// Batch processing schema
const BatchState = z.object({
  batchId: z.string(),
  totalDocuments: z.number(),
  completedDocuments: z.number(),
  failedDocuments: z.number(),
  startTime: z.date(),
  endTime: z.date().optional(),
  status: z.enum(['processing', 'completed', 'failed']),
  documents: z.array(z.number())
});

type BatchStateType = z.infer<typeof BatchState>;

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
  private activeBatches: Map<string, BatchStateType> = new Map();

  // Create a new batch processing job
  async createBatch(documentIds: number[]): Promise<BatchStateType> {
    const batchId = `batch-${Date.now()}`;
    const batchState: BatchStateType = {
      batchId,
      totalDocuments: documentIds.length,
      completedDocuments: 0,
      failedDocuments: 0,
      startTime: new Date(),
      status: 'processing',
      documents: documentIds
    };

    this.activeBatches.set(batchId, batchState);

    // Process all documents in the batch
    await Promise.all(
      documentIds.map(id => this.processDocument(id, batchId))
    );

    return batchState;
  }

  // Get batch processing status
  async getBatchStatus(batchId: string): Promise<BatchStateType | undefined> {
    return this.activeBatches.get(batchId);
  }

  // List all active batches
  async listActiveBatches(): Promise<BatchStateType[]> {
    return Array.from(this.activeBatches.values());
  }

  // Process a single document, optionally as part of a batch
  async processDocument(documentId: number, batchId?: string): Promise<DocumentStateType> {
    const run = await client.createRun({
      name: "Document Analysis Workflow",
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

      // Update document in database
      await db.update(vaultDocuments)
        .set({
          metadata: state.metadata,
          aiClassification: state.analysis.documentType
        })
        .where(eq(vaultDocuments.id, documentId));

      // Update batch status if part of a batch
      if (batchId) {
        this.updateBatchProgress(batchId, true);
      }

      await client.updateRun({
        runId: run.id,
        outputs: state
      });

      return state;

    } catch (error) {
      await client.updateRun({
        runId: run.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Update batch status if part of a batch
      if (batchId) {
        this.updateBatchProgress(batchId, false);
      }

      throw error;
    }
  }

  // Update batch progress
  private updateBatchProgress(batchId: string, success: boolean) {
    const batch = this.activeBatches.get(batchId);
    if (batch) {
      if (success) {
        batch.completedDocuments++;
      } else {
        batch.failedDocuments++;
      }

      // Check if batch is complete
      if (batch.completedDocuments + batch.failedDocuments === batch.totalDocuments) {
        batch.endTime = new Date();
        batch.status = batch.failedDocuments === 0 ? 'completed' : 'failed';
      }

      this.activeBatches.set(batchId, batch);
    }
  }

  private async runWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryCount = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        log(`Retrying ${operationName} (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        return this.runWithRetry(operation, operationName, retryCount + 1);
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
      if (error.message.includes('token limit exceeded')) {
        return {
          type: WorkflowErrorType.TOKEN_LIMIT,
          message: `Token limit exceeded in ${stage} stage: ${error.message}`,
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

      const versions = await db
        .select()
        .from(contractVersions)
        .where(eq(contractVersions.contractId, contractId))
        .orderBy(contractVersions.version);


      return versions.map(row => versionSchema.parse(row));
    } catch (error) {
      const workflowError = this.handleError(error, 'version_history');
      await this.logWorkflowEvent(contractId, 'version_history_error', workflowError);
      throw new Error('Failed to fetch version history');
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
      // Get the latest version number using Drizzle
      const result = await db
        .select({ maxVersion: contractVersions.version })
        .from(contractVersions)
        .where(eq(contractVersions.contractId, contractId))
        .orderBy(contractVersions.version)
        .limit(1);

      const nextVersion = (result[0]?.maxVersion || 0) + 1;

      // Insert new version using Drizzle
      const [newVersion] = await db
        .insert(contractVersions)
        .values({
          contractId,
          version: nextVersion,
          status,
          author,
          changes,
          timestamp: new Date()
        })
        .returning();

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

  private async logWorkflowEvent(
    contractId: number,
    eventType: string,
    details: Record<string, any>
  ) {
    try {
      await db
        .insert(workflowEvents)
        .values({
          contractId,
          eventType,
          details,
          timestamp: new Date()
        });
    } catch (error) {
      console.error('Failed to log workflow event:', error);
      // Don't throw here to prevent workflow interruption
    }
  }
}

export const workflowOrchestrator = new WorkflowOrchestrator();