import { Router } from 'express';
import { analyzeContractClauses, getClauseImprovementSuggestions } from '../services/contract-analysis';
import { z } from 'zod';

const router = Router();

const analyzeRequestSchema = z.object({
  content: z.string().min(1, "Contract content is required"),
  industry: z.string().optional(),
  jurisdiction: z.string().optional(),
});

const clauseRequestSchema = z.object({
  clause: z.string().min(1, "Clause text is required"),
  industry: z.string().optional(),
  jurisdiction: z.string().optional(),
  category: z.string().optional(),
});

// Analyze entire contract
router.post('/analyze', async (req, res) => {
  try {
    const { content, industry, jurisdiction } = analyzeRequestSchema.parse(req.body);

    const analysis = await analyzeContractClauses(content, { industry, jurisdiction });

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

// Get improvement suggestions for a specific clause
router.post('/analyze/clause', async (req, res) => {
  try {
    const { clause, industry, jurisdiction, category } = clauseRequestSchema.parse(req.body);

    const suggestions = await getClauseImprovementSuggestions(clause, { 
      industry, 
      jurisdiction, 
      category 
    });

    return res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Clause analysis route error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze clause'
    });
  }
});

export default router;