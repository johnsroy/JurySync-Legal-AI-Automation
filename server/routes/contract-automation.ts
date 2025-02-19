import { Router } from 'express';
import { db } from '../db';
import { contractTemplates } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { anthropic } from '../anthropic';
import OpenAI from 'openai';
import { generateContract, parsePdfTemplate, generateTemplatePreview } from '../services/contract-automation-service';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as docx from 'docx';

async function generateSmartSuggestions(selectedText: string, documentContext: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a legal document expert specializing in contract analysis and variable replacement suggestions.
          When analyzing selected text, identify if it represents a variable field (like names, dates, addresses, amounts) 
          and suggest appropriate replacements based on common business contexts.
          Format response as a JSON array of objects with 'suggestion' and 'explanation' fields.`
        },
        {
          role: "user",
          content: `Analyze this selected text from a legal document and provide smart suggestions for replacement:
          Selected text: "${selectedText}"
          Document context: "${documentContext.substring(0, 500)}..."

          Consider:
          1. If this is a variable field that needs replacement
          2. Common business values for this type of field
          3. Format requirements (dates, currency, legal terms)
          4. Context-appropriate suggestions

          Return format example:
          [
            {
              "suggestion": "actual replacement text",
              "explanation": "why this replacement makes sense"
            }
          ]`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000
    });

    const suggestions = JSON.parse(response.choices[0].message.content || "{}");
    return suggestions;
  } catch (error) {
    console.error('Failed to generate smart suggestions:', error);
    throw error;
  }
}

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
    const { q: selectedText, context } = req.query;

    if (!selectedText || typeof selectedText !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Selected text is required'
      });
    }

    const smartSuggestions = await generateSmartSuggestions(
      selectedText,
      typeof context === 'string' ? context : ''
    );

    return res.json({
      success: true,
      suggestions: smartSuggestions
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

      // Function to create a new page with consistent margins
      const createPage = () => {
        const page = pdfDoc.addPage([612, 792]); // US Letter size
        return page;
      };

      // Function to wrap text and return array of lines
      const wrapText = (text: string, maxWidth: number, font: any, fontSize: number) => {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
          const word = words[i];
          const width = font.widthOfTextAtSize(currentLine + ' ' + word, fontSize);

          if (width < maxWidth) {
            currentLine += ' ' + word;
          } else {
            lines.push(currentLine);
            currentLine = word;
          }
        }
        lines.push(currentLine);
        return lines;
      };

      let currentPage = createPage();
      const fontSize = 11;
      const lineHeight = fontSize * 1.5;
      const margin = 72; // 1 inch margins
      const maxWidth = currentPage.getWidth() - (margin * 2);
      let y = currentPage.getHeight() - margin;

      // Split content into paragraphs
      const paragraphs = content.split('\n').filter(para => para.trim());

      for (const paragraph of paragraphs) {
        // Wrap text to fit within margins
        const lines = wrapText(paragraph.trim(), maxWidth, timesRomanFont, fontSize);

        for (const line of lines) {
          if (y < margin + lineHeight) {
            // Create new page if we're out of space
            currentPage = createPage();
            y = currentPage.getHeight() - margin;
          }

          currentPage.drawText(line, {
            x: margin,
            y,
            size: fontSize,
            font: timesRomanFont,
            color: rgb(0, 0, 0),
            lineHeight,
            maxWidth
          });

          y -= lineHeight;
        }

        // Add extra space between paragraphs
        y -= lineHeight;
      }

      const pdfBytes = await pdfDoc.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=contract.pdf');
      return res.send(Buffer.from(pdfBytes));
    } else if (format === 'docx') {
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