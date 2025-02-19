import { Router } from 'express';
import { db } from '../db';
import { contractTemplates } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { anthropic } from '../anthropic';
import OpenAI from 'openai';

const router = Router();
const openai = new OpenAI();

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

// Get all templates with search and filtering
router.get('/templates', async (req, res) => {
  try {
    console.log("Fetching contract templates...");
    const { search, category } = req.query;

    let templates = await db.select().from(contractTemplates);
    console.log(`Found ${templates.length} total templates`);

    // Filter templates if search is provided
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      templates = templates.filter(template => 
        template.name.toLowerCase().includes(searchLower) ||
        template.description.toLowerCase().includes(searchLower) ||
        template.category.toLowerCase().includes(searchLower)
      );
      console.log(`Found ${templates.length} templates after search filtering`);
    }

    // Filter by category if provided
    if (category && typeof category === 'string') {
      templates = templates.filter(template => 
        template.category === category
      );
      console.log(`Found ${templates.length} templates after category filtering`);
    }

    // Group templates by category for frontend display
    const groupedTemplates = templates.reduce((acc, template) => {
      const category = template.category;
      if (!acc[category]) {
        acc[category] = [];
      }

      acc[category].push({
        id: template.id.toString(),
        name: template.name,
        description: template.description,
        category: template.category,
        content: template.content,
        metadata: template.metadata
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

// AI Suggestions endpoint with improved context awareness
router.get('/suggestions', async (req, res) => {
  try {
    const { q: query } = req.query;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    // Use OpenAI for main suggestions
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: "You are a legal document expert. Generate specific, actionable suggestions for contract requirements."
      }, {
        role: "user",
        content: `Given this query about legal documents: "${query}"
        Provide 3-5 specific suggestions focusing on:
        - Required clauses
        - Legal considerations
        - Industry-specific requirements
        Format as a bulleted list.`
      }],
      max_tokens: 1000
    });

    // Use Anthropic for additional context and refinement
    const anthropicResponse = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Given these initial suggestions for "${query}":
        ${completion.choices[0].message.content}

        Enhance these suggestions with:
        1. Industry best practices
        2. Regulatory requirements
        3. Risk mitigation strategies`
      }]
    });

    const suggestions = anthropicResponse.content[0].text
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^[-•]\s*/, '').trim());

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

// Template usage endpoint
router.post('/use-template/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { variables } = req.body;

    // Fetch the template
    const [template] = await db
      .select()
      .from(contractTemplates)
      .where(eq(contractTemplates.id, parseInt(templateId)));

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Validate required variables
    const missingVariables = template.metadata.variables
      .filter(v => v.required && !variables[v.name])
      .map(v => v.name);

    if (missingVariables.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required variables',
        missingVariables
      });
    }

    // Replace variables in content
    let content = template.content;
    Object.entries(variables).forEach(([key, value]) => {
      content = content.replace(new RegExp(`\\[${key}\\]`, 'g'), value as string);
    });

    // Generate suggestions for the customized content using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: "You are a legal document expert. Review this contract and suggest improvements."
      }, {
        role: "user",
        content: `Review this contract and suggest specific improvements:
        ${content}

        Focus on:
        1. Clarity and readability
        2. Legal completeness
        3. Risk mitigation
        `
      }],
      max_tokens: 1000
    });

    return res.json({
      success: true,
      document: {
        content,
        suggestions: completion.choices[0].message.content,
        metadata: template.metadata
      }
    });

  } catch (error) {
    console.error('Failed to process template:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process template'
    });
  }
});

export default router;