import { Router } from 'express';
import { db } from '../db';
import { contractTemplates } from '@shared/schema';
import { generateContract } from '../services/contract-automation-service';
import { eq } from 'drizzle-orm';
import multer from 'multer';
import { generatePDF } from '../services/pdf-service';
import { seedContractTemplates } from '../services/seedContractTemplates';
import { sql } from 'drizzle-orm';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get all templates
router.get('/templates', async (req, res) => {
  try {
    console.log("Fetching contract templates...");
    
    // Get query parameters
    const { search, category } = req.query;
    
    let query = db
      .select()
      .from(contractTemplates);
    
    // Add search conditions if provided
    if (search) {
      query = query.where(
        sql`(
          name ILIKE ${`%${search}%`} OR 
          description ILIKE ${`%${search}%`} OR 
          metadata->>'tags' ? ${search}
        )`
      );
    }
    
    // Add category filter if provided
    if (category) {
      query = query.where(eq(contractTemplates.category, category as string));
    }
    
    // Execute query
    const templates = await query.orderBy(contractTemplates.category, contractTemplates.name);

    console.log(`Found ${templates.length} templates`);
    
    // If no templates exist, seed the database
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
      
      // Group seeded templates by category
      const groupedTemplates = seededTemplates.reduce((acc, template) => {
        if (!acc[template.category]) {
          acc[template.category] = [];
        }
        acc[template.category].push(template);
        return acc;
      }, {} as Record<string, typeof seededTemplates>);

      return res.json({
        success: true,
        templates: groupedTemplates
      });
    }

    // Group existing templates by category
    const groupedTemplates = templates.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    }, {} as Record<string, typeof templates>);

    return res.json({
      success: true,
      templates: groupedTemplates
    });
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch templates',
      details: error instanceof Error ? error.message : 'Unknown error'
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

// Add to existing route file
router.get('/templates/search', async (req, res) => {
  try {
    const { query, category } = req.query;
    
    let conditions = [];
    
    if (query) {
      conditions.push(
        sql`(
          name ILIKE ${`%${query}%`} OR
          description ILIKE ${`%${query}%`} OR
          metadata->>'tags' ? ${query}
        )`
      );
    }
    
    if (category) {
      conditions.push(sql`category = ${category}`);
    }
    
    const templates = await db
      .select()
      .from(contractTemplates)
      .where(conditions.length ? sql`${sql.join(conditions, sql` AND `)}` : undefined)
      .orderBy(sql`popularity_score DESC`);
      
    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed'
    });
  }
});

export default router; 