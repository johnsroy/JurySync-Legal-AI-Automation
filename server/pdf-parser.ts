import type { ExtractedContent } from "./types";
import pdf from "pdf-parse";

export async function parsePDF(buffer: Buffer): Promise<ExtractedContent> {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty PDF buffer received');
  }

  try {
    const dataBuffer = Buffer.from(buffer);
    const pdfData = await pdf(dataBuffer, {
      // Override the default pagerender to prevent test file loading
      pagerender: undefined,
      // Disable test file loading
      _initialized: true
    });

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      throw new Error('No text content extracted from PDF');
    }

    const sections = [];
    let currentSection = { title: '', content: '', level: 1 };

    // Split by potential section headers
    const lines = pdfData.text.split('\n');
    for (const line of lines) {
      // Enhanced header detection
      const isHeader = line.match(/^[A-Z\d]+[\.\)]\s+[A-Z]/) || 
                     line.match(/^[IVX]+\.\s+[A-Z]/) ||
                     line.match(/^[A-Z][A-Z\s]{2,}$/);

      if (isHeader) {
        if (currentSection.content) {
          sections.push(currentSection);
        }
        currentSection = {
          title: line.trim(),
          content: '',
          level: 1
        };
      } else {
        currentSection.content += line + '\n';
      }
    }

    if (currentSection.content) {
      sections.push(currentSection);
    }

    // If no sections were detected, create one with the entire content
    if (sections.length === 0) {
      sections.push({
        title: 'Document Content',
        content: pdfData.text,
        level: 1
      });
    }

    return {
      text: pdfData.text,
      sections,
      metadata: {
        title: pdfData.info?.Title,
        author: pdfData.info?.Author,
        creationDate: pdfData.info?.CreationDate,
        lastModified: pdfData.info?.ModDate,
      }
    };
  } catch (error: any) {
    console.error('PDF parsing error:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}