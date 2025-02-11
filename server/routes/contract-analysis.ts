import { Router } from 'express';
import { z } from 'zod';
import { contractAnalysisService } from '../services/contractAnalysisService';

const router = Router();

const analyzeRequestSchema = z.object({
  content: z.string().min(1, "Contract content is required"),
  industry: z.string().optional(),
  jurisdiction: z.string().optional(),
});

// Analyze entire contract
router.post('/analyze', async (req, res) => {
  try {
    const { content } = analyzeRequestSchema.parse(req.body);

    const analysis = await contractAnalysisService.analyzeContract(content);

    return res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('Contract analysis route error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze contract'
    });
  }
});

// Update a clause suggestion
router.post('/clauses/:clauseId/update', async (req, res) => {
  try {
    const { clauseId } = req.params;
    const { content } = z.object({
      content: z.string().min(1, "New clause content is required")
    }).parse(req.body);

    const updatedAnalysis = await contractAnalysisService.analyzeClause({
      text: content,
      startIndex: 0,
      endIndex: content.length
    }, parseInt(clauseId.split('-')[1]) - 1);

    return res.json({
      success: true,
      analysis: updatedAnalysis
    });
  } catch (error) {
    console.error('Clause update route error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update clause'
    });
  }
});

export default router;