import { Router } from 'express';
import { db } from '../db';
import { contractTemplates } from '@shared/schema';
import { generateContract, getCustomInstructionSuggestions, suggestRequirements } from '../services/templateStore';
import { eq } from 'drizzle-orm';
import { seedContractTemplates } from '../services/seedContractTemplates';
import { sql } from 'drizzle-orm';

const router = Router();

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
        sql`name ILIKE ${`%${search}%`} OR 
            description ILIKE ${`%${search}%`} OR 
            metadata->>'tags' ? ${search}`
      );
    }

    // Add category filter if provided
    if (category) {
      query = query.where(eq(contractTemplates.category, category as string));
    }

    // Execute query
    const templates = await query;
    console.log(`Found ${templates.length} templates`);

    // If no templates exist, seed the database
    if (templates.length === 0) {
      console.log("No templates found, initiating seeding...");
      await seedContractTemplates();

      // Fetch templates again after seeding
      const seededTemplates = await db
        .select()
        .from(contractTemplates);

      console.log(`Seeded and found ${seededTemplates.length} templates`);

      if (seededTemplates.length === 0) {
        throw new Error("Failed to seed and fetch templates");
      }

      // Group templates by category
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

// Get template suggestions
router.get('/suggestions', async (req, res) => {
  try {
    const { q: query } = req.query;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    const suggestions = await suggestRequirements('general', query);
    return res.json({
      success: true,
      suggestions: suggestions.map(s => s.description)
    });
  } catch (error) {
    console.error('Failed to get suggestions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get suggestions'
    });
  }
});

// Get custom instructions
router.post('/custom-instructions', async (req, res) => {
  try {
    const { templateId, requirements } = req.body;
    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Template ID is required'
      });
    }

    const suggestions = await getCustomInstructionSuggestions(templateId, requirements);
    return res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Failed to get custom instructions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get custom instructions'
    });
  }
});

// Generate contract from template
router.post('/generate', async (req, res) => {
  try {
    const { templateId, customClauses } = req.body;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Template ID is required'
      });
    }

    const contract = await generateContract(templateId, [], customClauses);

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

export default router;