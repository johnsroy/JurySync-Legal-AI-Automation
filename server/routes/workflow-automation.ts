import { Router } from 'express';
import { AIOrchestrator } from '../services/ai-orchestrator';
import multer from 'multer';
import { z } from 'zod';

const router = Router();
const upload = multer();
const aiOrchestrator = new AIOrchestrator();

// Schema for document upload
const documentSchema = z.object({
  content: z.string().min(1),
  type: z.enum(['upload', 'paste'])
});

router.post('/process', upload.single('document'), async (req, res) => {
  try {
    let content: string;
    let type: 'upload' | 'paste';

    // Handle file upload
    if (req.file) {
      content = req.file.buffer.toString();
      type = 'upload';
    } else {
      // Handle pasted content
      const validation = documentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid document data'
        });
      }
      content = validation.data.content;
      type = validation.data.type;
    }

    // Process with AI orchestrator
    const result = await aiOrchestrator.processDocument(content, type);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Workflow automation error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Workflow automation failed'
    });
  }
});

export default router; 