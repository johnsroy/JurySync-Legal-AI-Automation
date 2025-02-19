import { Router } from 'express';
import { db } from '../db';
import { contractTemplates } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { anthropic } from '../anthropic';
import OpenAI from 'openai';
import { generateContract, parsePdfTemplate, generateTemplatePreview } from '../services/contract-automation-service';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as docx from 'docx';

const router = Router();
const openai = new OpenAI();

// Get all templates with search and filtering
router.get('/templates', async (req, res) => {
  try {
    const { search, category } = req.query;
    let templates = await db.select().from(contractTemplates);

    // Filter by search if provided
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      templates = templates.filter(template => 
        template.name.toLowerCase().includes(searchLower) ||
        template.description.toLowerCase().includes(searchLower)
      );
    }

    // Filter by category if provided
    if (category && typeof category === 'string') {
      templates = templates.filter(template => template.category === category);
    }

    // Format response for frontend
    const groupedTemplates = templates.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    }, {} as Record<string, any[]>);

    return res.json({
      success: true,
      templates: groupedTemplates
    });
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch templates'
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

    // Use both OpenAI and Anthropic for enhanced suggestions
    const [openaiResponse, anthropicResponse] = await Promise.all([
      openai.chat.completions.create({
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
          Format as JSON array of strings.`
        }],
        response_format: { type: "json_object" },
        max_tokens: 1000
      }),
      anthropic.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Given this query about legal documents: "${query}"
          Provide 3-5 specific suggestions for legal document content and clauses.
          Format as bullet points.`
        }]
      })
    ]);

    const openaiSuggestions = JSON.parse(openaiResponse.choices[0].message.content || "[]");
    const anthropicSuggestions = anthropicResponse.content[0].text
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^[-•]\s*/, '').trim());

    // Combine and deduplicate suggestions
    const allSuggestions = [...new Set([...openaiSuggestions, ...anthropicSuggestions])];

    return res.json({
      success: true,
      suggestions: allSuggestions
    });
  } catch (error) {
    console.error('Failed to get suggestions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get suggestions'
    });
  }
});

// Download endpoint with improved handling
router.post('/download', async (req, res) => {
  try {
    const { content, format } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    if (format === 'pdf') {
      const pdfDoc = await PDFDocument.create();
      const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const page = pdfDoc.addPage([612, 792]); // Standard US Letter size

      const fontSize = 12;
      const lineHeight = fontSize * 1.2;
      let y = page.getHeight() - 50;
      const margin = 50;
      const maxWidth = page.getWidth() - (margin * 2);

      const lines = content.split('\n');
      for (const line of lines) {
        if (y < margin) {
          // Add new page if we run out of space
          const newPage = pdfDoc.addPage([612, 792]);
          y = newPage.getHeight() - 50;
        }

        // Draw the text
        page.drawText(line.trim(), {
          x: margin,
          y,
          size: fontSize,
          font: timesRomanFont,
          maxWidth
        });

        y -= lineHeight;
      }

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
              children: [
                new docx.TextRun({
                  text: content,
                  font: "Times New Roman",
                  size: 24 // 12pt
                })
              ]
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