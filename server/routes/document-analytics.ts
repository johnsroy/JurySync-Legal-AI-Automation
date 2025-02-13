import { Router } from 'express';
import { z } from 'zod';
import { DocumentAnalyticsService } from '../services/documentAnalytics';

const router = Router();
const documentAnalyticsService = new DocumentAnalyticsService();

// Validation schema for workflow results
const workflowResultSchema = z.array(z.object({
  stageType: z.enum(['classification', 'compliance', 'research']),
  content: z.string(),
  status: z.string().optional(),
  riskScore: z.number().optional()
}));

router.post('/process', async (req, res) => {
  try {
    const { workflowResults } = req.body;
    
    // Validate input
    const validatedResults = workflowResultSchema.parse(workflowResults);
    
    // Process the workflow results
    const metadata = await documentAnalyticsService.processWorkflowResults(validatedResults);
    
    res.json(metadata);
  } catch (error) {
    console.error('Document analytics processing error:', error);
    res.status(500).json({
      error: 'Failed to process document analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
