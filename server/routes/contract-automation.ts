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

    let templates = await db.select().from(contractTemplates);
    console.log(`Found ${templates.length} templates`);

    // Filter templates if search is provided
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      templates = templates.filter(template => 
        template.name.toLowerCase().includes(searchLower) ||
        template.description.toLowerCase().includes(searchLower) ||
        template.category.toLowerCase().includes(searchLower)
      );
    }

    // Filter by category if provided
    if (category && typeof category === 'string') {
      templates = templates.filter(template => 
        template.category === category
      );
    }

    // Group templates by category
    const groupedTemplates = templates.reduce((acc, template) => {
      const category = template.category;
      if (!acc[category]) {
        acc[category] = [];
      }

      // Ensure template matches frontend expectations
      acc[category].push({
        id: template.id.toString(),
        name: template.name,
        description: template.description,
        category: template.category,
        content: template.content,
        metadata: {
          ...template.metadata,
          variables: template.metadata.variables || []
        }
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