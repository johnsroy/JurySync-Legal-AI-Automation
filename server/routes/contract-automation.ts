import { Router } from 'express';
import { db } from '../db';
import { contractTemplates } from '@shared/schema';
import { templateStore } from '../services/templateStore';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { anthropic } from '../anthropic';

const router = Router();

// Get all templates with search and filtering
router.get('/templates', async (req, res) => {
  try {
    console.log("Fetching contract templates...");
    const { search, category } = req.query;

    // Start with a base query
    let baseQuery = db.select().from(contractTemplates);

    // Add search condition if provided
    if (search) {
      const searchPattern = `%${search}%`;
      baseQuery = baseQuery.where(
        sql`name ILIKE ${searchPattern} OR description ILIKE ${searchPattern} OR category ILIKE ${searchPattern}`
      );
    }

    // Add category filter if provided
    if (category) {
      baseQuery = baseQuery.where(eq(contractTemplates.category, category as string));
    }

    const templates = await baseQuery;
    console.log(`Found ${templates.length} templates`);

    // Group templates by category for frontend display
    const groupedTemplates = templates.reduce((acc, template) => {
      const category = template.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({
        ...template,
        id: template.id.toString(),
        variables: template.metadata?.variables || []
      });
      return acc;
    }, {} as Record<string, any[]>);

    return res.json({
      success: true,
      templates: groupedTemplates,
      totalCount: templates.length
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

    // Use Anthropic for intelligent suggestions
    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Given this query about legal documents: "${query}"
        Suggest 3-5 relevant requirements or considerations that would be important for this type of document.
        Format each suggestion as a clear, actionable item.`
      }]
    });

    const suggestions = response.content[0].text
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^\d+\.\s*/, '').trim());

    return res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Failed to get suggestions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get suggestions'
    });
  }
});

export default router;