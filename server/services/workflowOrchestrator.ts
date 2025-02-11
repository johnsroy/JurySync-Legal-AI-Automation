import { db } from "../db";
import { documentVersions, documents, type DocumentVersion } from "@shared/schema";
import { eq, desc } from 'drizzle-orm';
import { z } from "zod";

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

// Version history schema
const versionSchema = z.object({
  id: z.number(),
  documentId: z.number(),
  versionNumber: z.number(),
  content: z.string(),
  status: z.enum(['draft', 'review', 'approved', 'rejected']),
  createdAt: z.date(),
  authorId: z.number(),
  changes: z.object({
    description: z.string(),
    modifiedSections: z.array(z.object({
      type: z.enum(["ADDITION", "DELETION", "MODIFICATION"]),
      content: z.string(),
      lineNumber: z.number().optional(),
    }))
  })
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

      // TODO: Integrate with Documenso API here
      // For now, create a new version with signature pending status
      const newVersion = await this.createVersion(contractId, {
        status: 'review',
        author: 'System',
        changes: 'Submitted for signature',
        content: 'Pending signature'
      });

      return {
        versionId: newVersion.id,
        status: 'pending',
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

      const newVersion = await this.createVersion(contractId, {
        status: 'review',
        author: 'System',
        changes: 'Submitted for internal review',
        content: 'Under review'
      });

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

      const versions = await db.select()
        .from(documentVersions)
        .where(eq(documentVersions.documentId, contractId))
        .orderBy(desc(documentVersions.versionNumber));

      return versions.map(version => versionSchema.parse(version));
    } catch (error) {
      const workflowError = this.handleError(error, 'version_history');
      await this.logWorkflowEvent(contractId, 'version_history_error', workflowError);
      throw new Error('Failed to fetch version history');
    }
  }

  async getDiagnosticReport(contractId: number) {
    try {
      const events = await db.query(
        'SELECT * FROM workflow_events WHERE contract_id = $1 ORDER BY timestamp DESC',
        [contractId]
      );

      const diagnosticReport = {
        contractId,
        totalEvents: events.rowCount,
        errors: events.rows.filter(e => e.event_type.endsWith('_error')),
        stages: this.aggregateStageMetrics(events.rows),
        recommendations: this.generateRecommendations(events.rows)
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
    changes,
    content
  }: {
    status: 'draft' | 'review' | 'approved' | 'rejected',
    author: string,
    changes: string,
    content: string
  }): Promise<DocumentVersion> {
    try {
      // Get the latest version number
      const versions = await db.select()
        .from(documentVersions)
        .where(eq(documentVersions.documentId, contractId))
        .orderBy(desc(documentVersions.versionNumber));

      const nextVersion = versions.length > 0 ? versions[0].versionNumber + 1 : 1;

      // Insert new version
      const [newVersion] = await db.insert(documentVersions)
        .values({
          documentId: contractId,
          versionNumber: nextVersion,
          status,
          authorId: 1, // TODO: Get from current user
          content,
          changes: {
            description: changes,
            modifiedSections: []
          }
        })
        .returning();

      return newVersion;
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
      // Store workflow events in the document's analysis field
      const [document] = await db.select()
        .from(documents)
        .where(eq(documents.id, contractId));

      if (document) {
        const analysis = document.analysis || {};
        const events = analysis.workflowEvents || [];
        events.push({
          type: eventType,
          details,
          timestamp: new Date().toISOString()
        });

        await db.update(documents)
          .set({
            analysis: {
              ...analysis,
              workflowEvents: events
            }
          })
          .where(eq(documents.id, contractId));
      }
    } catch (error) {
      console.error('Failed to log workflow event:', error);
      // Don't throw here to prevent workflow interruption
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
  private retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryCount = 0
  ): Promise<T> {
    try {
      return operation();
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        console.log(`Retrying ${operationName} (attempt ${retryCount + 1})`);
        setTimeout(() => {}, this.RETRY_DELAY);
        return this.retryOperation(operation, operationName, retryCount + 1);
      }
      throw error;
    }
  }
  private aggregateStageMetrics(events: any[]) {
    const stages = new Map<string, {
      totalTime: number;
      errorCount: number;
      retryCount: number;
    }>();

    events.forEach(event => {
      const stage = event.event_type.split('_')[0];
      const current = stages.get(stage) || { totalTime: 0, errorCount: 0, retryCount: 0 };

      if (event.event_type.endsWith('_error')) {
        current.errorCount++;
      }
      if (event.details.retryCount) {
        current.retryCount += event.details.retryCount;
      }

      stages.set(stage, current);
    });

    return Object.fromEntries(stages);
  }

  private generateRecommendations(events: any[]) {
    const recommendations: string[] = [];
    const errorCounts = new Map<WorkflowErrorType, number>();

    events
      .filter(e => e.event_type.endsWith('_error'))
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