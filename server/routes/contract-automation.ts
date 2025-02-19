import { Router } from 'express';
import { db } from '../db';
import { contractTemplates } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { anthropic } from '../anthropic';
import OpenAI from 'openai';
import { generateContract } from '../services/contract-automation-service';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as docx from 'docx';

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
    const { variables, customClauses } = req.body;

    const result = await generateContract({
      templateId,
      variables,
      customClauses,
      aiAssistance: true
    });

    return res.json({
      success: true,
      document: result
    });

  } catch (error) {
    console.error('Failed to process template:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process template'
    });
  }
});

// Download endpoint
router.post('/download', async (req, res) => {
  try {
    const { content, format } = req.body;

    if (format === 'pdf') {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);

      const lines = content.split('\n');
      let y = page.getHeight() - 50;

      lines.forEach(line => {
        if (y > 50) {
          page.drawText(line, {
            x: 50,
            y,
            font,
            size: 12
          });
          y -= 15;
        }
      });

      const pdfBytes = await pdfDoc.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=contract.pdf');
      return res.send(Buffer.from(pdfBytes));
    } 
    else if (format === 'docx') {
      const doc = new docx.Document({
        sections: [{
          properties: {},
          children: [
            new docx.Paragraph({
              children: [new docx.TextRun(content)]
            })
          ]
        }]
      });

      const buffer = await docx.Packer.toBuffer(doc);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename=contract.docx');
      return res.send(buffer);
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid format specified'
    });
  } catch (error) {
    console.error('Failed to generate document:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate document'
    });
  }
});

export default router;