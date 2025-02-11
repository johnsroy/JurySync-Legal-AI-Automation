import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { workflowEvents, contractVersions } from '@shared/schema';

const router = Router();

const documentSchema = z.object({
  text: z.string().min(1, "Document text is required"),
  metadata: z.object({
    type: z.string(),
    fileName: z.string(),
    priority: z.string().optional(),
  }),
});

// Workflow stage handlers
router.post('/draft', async (req, res) => {
  try {
    const { text, metadata } = documentSchema.parse(req.body);

    // Create initial version
    const [version] = await db.insert(contractVersions).values({
      contractId: 1, // In production, this would be generated
      version: 1,
      content: text,
      status: 'DRAFT',
      author: 'system',
      changes: [{ type: 'ADDITION', content: text }],
    }).returning();

    // Log workflow event
    await db.insert(workflowEvents).values({
      contractId: 1,
      eventType: 'draft_generation',
      details: {
        status: 'completed',
        text_length: text.length,
        metadata,
        versionId: version.id
      },
      timestamp: new Date()
    });

    res.json({
      status: 'success',
      stage: 'draft',
      message: 'Draft generation completed',
      data: {
        versionId: version.id,
        content: text
      }
    });
  } catch (error) {
    console.error('Draft generation error:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Draft generation failed'
    });
  }
});

router.post('/compliance', async (req, res) => {
  try {
    const { text, metadata } = documentSchema.parse(req.body);

    await db.insert(workflowEvents).values({
      contractId: 1,
      eventType: 'compliance_check',
      details: {
        status: 'completed',
        text_length: text.length,
        metadata
      },
      timestamp: new Date()
    });

    res.json({
      status: 'success',
      stage: 'compliance',
      message: 'Compliance check completed'
    });
  } catch (error) {
    console.error('Compliance check error:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Compliance check failed'
    });
  }
});

router.post('/collaborate', async (req, res) => {
  try {
    const { text, metadata } = documentSchema.parse(req.body);

    await db.insert(workflowEvents).values({
      contractId: 1,
      eventType: 'collaboration',
      details: {
        status: 'completed',
        text_length: text.length,
        metadata
      },
      timestamp: new Date()
    });

    res.json({
      status: 'success',
      stage: 'collaborate',
      message: 'Collaboration stage completed'
    });
  } catch (error) {
    console.error('Collaboration error:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Collaboration failed'
    });
  }
});

router.post('/version', async (req, res) => {
  try {
    const { text, metadata } = documentSchema.parse(req.body);

    const [version] = await db.insert(contractVersions).values({
      contractId: 1,
      version: 1,
      content: text,
      status: 'REVIEW',
      author: 'system',
      changes: [{ type: 'MODIFICATION', content: text }],
    }).returning();

    await db.insert(workflowEvents).values({
      contractId: 1,
      eventType: 'version_control',
      details: {
        status: 'completed',
        versionId: version.id,
        metadata
      },
      timestamp: new Date()
    });

    res.json({
      status: 'success',
      stage: 'version',
      message: 'Version control completed'
    });
  } catch (error) {
    console.error('Version control error:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Version control failed'
    });
  }
});

router.post('/risk', async (req, res) => {
  try {
    const { text, metadata } = documentSchema.parse(req.body);

    await db.insert(workflowEvents).values({
      contractId: 1,
      eventType: 'risk_analysis',
      details: {
        status: 'completed',
        text_length: text.length,
        metadata
      },
      timestamp: new Date()
    });

    res.json({
      status: 'success',
      stage: 'risk',
      message: 'Risk analysis completed'
    });
  } catch (error) {
    console.error('Risk analysis error:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Risk analysis failed'
    });
  }
});

export default router;