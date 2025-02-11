import { Router } from 'express';
import { z } from 'zod';
import { contractAnalysisService } from '../services/contractAnalysisService';
import { workflowOrchestrator } from '../services/workflowOrchestrator';

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

    const updatedAnalysis = await contractAnalysisService.updateClause({
      text: content,
      startIndex: 0, 
      endIndex: content.length
    }, clauseId);

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

// Start e-signature process
router.post('/:contractId/signature', async (req, res) => {
  try {
    const { contractId } = req.params;
    const result = await workflowOrchestrator.initiateSignature(parseInt(contractId));

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('E-signature initiation error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate e-signature process'
    });
  }
});

// Start internal review process
router.post('/:contractId/review', async (req, res) => {
  try {
    const { contractId } = req.params;
    const result = await workflowOrchestrator.initiateReview(parseInt(contractId));

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Review initiation error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate review process'
    });
  }
});

// Get contract version history
router.get('/:contractId/versions', async (req, res) => {
  try {
    const { contractId } = req.params;
    const versions = await workflowOrchestrator.getVersionHistory(parseInt(contractId));

    return res.json({
      success: true,
      versions
    });
  } catch (error) {
    console.error('Version history error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch version history'
    });
  }
});

// Get diagnostic report
router.get('/:contractId/diagnostic', async (req, res) => {
  try {
    const { contractId } = req.params;
    const report = await workflowOrchestrator.getDiagnosticReport(parseInt(contractId));

    return res.json({
      success: true,
      ...report
    });
  } catch (error) {
    console.error('Diagnostic report error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate diagnostic report'
    });
  }
});

export default router;