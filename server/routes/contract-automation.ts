import { Router } from 'express';
import { db } from '../db';
import { contractTemplates } from '@shared/schema';
import { templateStore } from '../services/templateStore';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { seedContractTemplates } from '../services/seedContractTemplates';

const router = Router();

// Get all templates with search and filtering
router.get('/templates', async (req, res) => {
  try {
    console.log("Fetching contract templates...");
    const { search, category } = req.query;

    let query = db.select().from(contractTemplates);

    if (search) {
      query = query.where(
        sql`name ILIKE ${`%${search}%`} OR 
            description ILIKE ${`%${search}%`} OR 
            metadata->>'tags' ? ${search}`
      );
    }

    if (category) {
      query = query.where(eq(contractTemplates.category, category as string));
    }

    const templates = await query;
    console.log(`Found ${templates.length} templates`);

    // If no templates exist, seed the database
    if (templates.length === 0) {
      console.log("No templates found, initiating seeding...");
      await seedContractTemplates();

      const seededTemplates = await db
        .select()
        .from(contractTemplates)
        .orderBy(contractTemplates.category);

      if (seededTemplates.length === 0) {
        throw new Error("Failed to seed and fetch templates");
      }

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

// AI Suggestions endpoint
router.get('/suggestions', async (req, res) => {
  try {
    const { q: query } = req.query;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    const suggestions = await templateStore.suggestRequirements('general', query);
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

// Autocomplete endpoint
router.get('/autocomplete', async (req, res) => {
  try {
    const { templateId, text } = req.query;
    if (!templateId || !text || typeof templateId !== 'string' || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Template ID and text parameters are required'
      });
    }

    const suggestions = await templateStore.getAutocomplete(templateId, text);
    return res.json({
      success: true,
      ...suggestions
    });
  } catch (error) {
    console.error('Failed to get autocomplete suggestions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get autocomplete suggestions'
    });
  }
});

// Custom instructions endpoint
router.post('/custom-instructions', async (req, res) => {
  try {
    const { templateId, requirements } = req.body;
    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Template ID is required'
      });
    }

    const suggestions = await templateStore.getCustomInstructionSuggestions(templateId, requirements);
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

export default router;