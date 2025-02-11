import { db } from "../db";
import { z } from "zod";
import { eq, and } from 'drizzle-orm';
import { 
  workflowEvents,
  contractVersions,
  type WorkflowEvent,
  type ContractVersion
} from "@shared/schema";

// Workflow stage types
type WorkflowStage = 'draft' | 'review' | 'approval' | 'signature' | 'audit';

// Error types for different failure scenarios
enum WorkflowErrorType {
  API_TIMEOUT = 'API_TIMEOUT',
  MISSING_DATA = 'MISSING_DATA',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  ROUTING_ERROR = 'ROUTING_ERROR',
  UNKNOWN = 'UNKNOWN'
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

// Version schema
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

      const versions = await db.select().from(contractVersions)
        .where(eq(contractVersions.contractId, contractId))
        .orderBy(contractVersions.version);

      return versions.map(version => versionSchema.parse(version));
    } catch (error) {
      const workflowError = this.handleError(error, 'version_history');
      await this.logWorkflowEvent(contractId, 'version_history_error', workflowError);
      throw new Error('Failed to fetch version history');
    }
  }

  async getDiagnosticReport(contractId: number) {
    try {
      const events = await db.select().from(workflowEvents)
        .where(eq(workflowEvents.contractId, contractId))
        .orderBy(workflowEvents.timestamp);

      const diagnosticReport = {
        contractId,
        totalEvents: events.length,
        errors: events.filter(e => e.eventType.endsWith('_error')),
        stages: this.aggregateStageMetrics(events),
        recommendations: this.generateRecommendations(events)
      };

      return {
        success: true,
        report: diagnosticReport
      };
    } catch (error) {
      console.error('Failed to generate diagnostic report:', error);
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
      const latestVersion = await db.select({ maxVersion: contractVersions.version })
        .from(contractVersions)
        .where(eq(contractVersions.contractId, contractId))
        .orderBy(contractVersions.version, 'desc')
        .limit(1);

      const nextVersion = (latestVersion[0]?.maxVersion || 0) + 1;

      // Insert new version
      const [newVersion] = await db.insert(contractVersions)
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

  private async logWorkflowEvent(
    contractId: number,
    eventType: string,
    details: Record<string, any>
  ) {
    try {
      await db.insert(workflowEvents).values({
        contractId,
        eventType,
        details: JSON.stringify(details),
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to log workflow event:', error);
      // Don't throw here to prevent workflow interruption
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
    }

    return {
      type: WorkflowErrorType.UNKNOWN,
      message: `Unknown error in ${stage} stage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp,
      retryCount: 0
    };
  }

  private aggregateStageMetrics(events: WorkflowEvent[]) {
    const stages = new Map<string, {
      totalTime: number,
      errorCount: number,
      retryCount: number
    }>();

    events.forEach(event => {
      const stage = event.eventType.split('_')[0];
      const current = stages.get(stage) || { totalTime: 0, errorCount: 0, retryCount: 0 };

      if (event.eventType.endsWith('_error')) {
        current.errorCount++;
      }
      if (event.details?.retryCount) {
        current.retryCount += event.details.retryCount;
      }

      stages.set(stage, current);
    });

    return Object.fromEntries(stages);
  }

  private generateRecommendations(events: WorkflowEvent[]) {
    const recommendations: string[] = [];
    const errorCounts = new Map<WorkflowErrorType, number>();

    events
      .filter(e => e.eventType.endsWith('_error'))
      .forEach(error => {
        const count = errorCounts.get(error.details.type) || 0;
        errorCounts.set(error.details.type, count + 1);
      });

    errorCounts.forEach((count, type) => {
      if (count > 3) {
        switch (type) {
          case WorkflowErrorType.API_TIMEOUT:
            recommendations.push('Consider increasing API timeout limits or implementing circuit breakers');
            break;
          case WorkflowErrorType.VALIDATION_ERROR:
            recommendations.push('Review input validation rules and data preprocessing steps');
            break;
          case WorkflowErrorType.ROUTING_ERROR:
            recommendations.push('Check workflow routing configuration and service availability');
            break;
        }
      }
    });

    return recommendations;
  }
}

export const workflowOrchestrator = new WorkflowOrchestrator();