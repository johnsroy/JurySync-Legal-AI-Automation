import { db } from "../db";
import { z } from "zod";

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

class WorkflowOrchestrator {
  async initiateSignature(contractId: number) {
    try {
      console.log(`Initiating e-signature process for contract ${contractId}`);
      
      // Simulate e-signature API call
      const signatureResponse: SignatureResponse = {
        signatureId: `sig-${Date.now()}`,
        status: 'pending',
        signers: [
          { email: 'signer1@example.com', status: 'pending' },
          { email: 'signer2@example.com', status: 'pending' }
        ]
      };

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
      console.error('E-signature initiation failed:', error);
      throw new Error('Failed to initiate e-signature process');
    }
  }

  async initiateReview(contractId: number) {
    try {
      console.log(`Initiating review process for contract ${contractId}`);

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
      console.error('Review initiation failed:', error);
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
      console.error('Failed to fetch version history:', error);
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
}

export const workflowOrchestrator = new WorkflowOrchestrator();
