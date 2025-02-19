import { Router } from 'express';
import { db } from '../db';
import { contractTemplates } from '@shared/schema';
import { generateContract } from '../services/contract-automation-service';
import { eq } from 'drizzle-orm';
import multer from 'multer';
import { generatePDF } from '../services/pdf-service';
import { seedContractTemplates } from '../services/seedContractTemplates';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get all templates
router.get('/templates', async (req, res) => {
  try {
    console.log("Fetching contract templates...");
    
    const templates = await db
      .select()
      .from(contractTemplates)
      .orderBy(contractTemplates.category, contractTemplates.name);

    console.log(`Found ${templates.length} templates`);
    
    if (templates.length === 0) {
      console.log("No templates found, initiating seeding...");
      await seedContractTemplates();
      
      // Fetch templates again after seeding
      const seededTemplates = await db
        .select()
        .from(contractTemplates)
        .orderBy(contractTemplates.category, contractTemplates.name);
        
      console.log(`Seeded and found ${seededTemplates.length} templates`);
      
      if (seededTemplates.length === 0) {
        throw new Error("Failed to seed and fetch templates");
      }
      
      templates = seededTemplates;
    }

    // Group templates by category
    const groupedTemplates = templates.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    }, {} as Record<string, typeof templates>);

    res.json({
      success: true,
      templates: groupedTemplates
    });
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates',
      details: error.message
    });
  }
});

// Generate contract from template
router.post('/templates/generate', async (req, res) => {
  try {
    const { templateId, variables, customClauses } = req.body;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Template ID is required'
      });
    }

    const contract = await generateContract({
      templateId,
      variables,
      customClauses,
      aiAssistance: true
    });

    res.json({
      success: true,
      contract
    });
  } catch (error) {
    console.error('Contract generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate contract'
    });
  }
});

// Download contract as PDF
router.post('/templates/download', async (req, res) => {
  try {
    const { content, metadata } = req.body;

    const pdf = await generatePDF(content, metadata);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=contract.pdf');
    res.send(pdf);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF'
    });
  }
});

export default router; 