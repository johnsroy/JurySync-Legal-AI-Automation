import { type Buffer } from "buffer";
import mammoth from 'mammoth';
import { db } from "../db";
import { complianceDocuments } from "@shared/schema";
import { eq } from "drizzle-orm";

const MAX_CONTENT_LENGTH = 32000;

export async function analyzePDFContent(buffer: Buffer, documentId: number): Promise<string> {
  try {
    console.log(`Starting document analysis${documentId !== -1 ? ` for document ${documentId}` : ''}`);

    let textContent = '';
    const fileType = await detectFileType(buffer);

    if (fileType === 'pdf') {
      // Dynamic import to avoid initialization issues
      const pdfParse = (await import('pdf-parse')).default;
      textContent = await pdfParse(buffer, {
        max: MAX_CONTENT_LENGTH,
        pagerender: render_page,
        version: 'v2.0.0'  // Use latest version
      }).then(data => data.text);
    } else if (fileType === 'docx') {
      textContent = await extractWordContent(buffer);
    } else {
      throw new Error('Unsupported file format. Please upload PDF or Word documents only.');
    }

    console.log(`Raw content extracted, length: ${textContent.length}`);

    // Enhanced content cleaning
    textContent = textContent
      .replace(/\u0000/g, '') // Remove null characters
      .replace(/[\uFFFD\uFFFE\uFFFF]/g, '') // Remove replacement characters
      .replace(/[\u0000-\u001F]/g, ' ') // Replace control characters with spaces
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/&[a-z]+;/gi, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (!textContent) {
      throw new Error('No valid content could be extracted from document');
    }

    // Truncate if necessary while preserving word boundaries
    if (textContent.length > MAX_CONTENT_LENGTH) {
      console.log(`Content exceeds maximum length, truncating from ${textContent.length} to ~${MAX_CONTENT_LENGTH} chars`);
      textContent = textContent.substring(0, MAX_CONTENT_LENGTH).replace(/\s+[^\s]*$/, '');
    }

    console.log(`Final content length: ${textContent.length}`);

    // Only update database if a valid document ID was provided
    if (documentId !== -1) {
      try {
        await db
          .update(complianceDocuments)
          .set({
            content: textContent,
            status: "MONITORING",
            lastScanned: new Date(),
            nextScanDue: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next scan in 24 hours
          })
          .where(eq(complianceDocuments.id, documentId));

        console.log('Database updated successfully');
      } catch (dbError) {
        console.error('Database update error:', dbError);
        throw new Error('Failed to update document in database');
      }
    }

    return textContent;

  } catch (error) {
    console.error("Document analysis error:", error);

    if (documentId !== -1) {
      try {
        await db
          .update(complianceDocuments)
          .set({ status: "ERROR" })
          .where(eq(complianceDocuments.id, documentId));
      } catch (dbError) {
        console.error('Failed to update error status:', dbError);
      }
    }

    throw new Error(`Failed to analyze document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function detectFileType(buffer: Buffer): Promise<'pdf' | 'docx'> {
  // Check for PDF magic number
  if (buffer.toString('ascii', 0, 5) === '%PDF-') {
    return 'pdf';
  }

  // Check for DOCX magic number (PK zip header)
  if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
    return 'docx';
  }

  throw new Error('Unsupported file format');
}

async function extractWordContent(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new Error(`Word document extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Custom render function for PDF pages
function render_page(pageData: any) {
  let render_options = {
    normalizeWhitespace: true,
    disableCombineTextItems: false
  };
  return pageData.getTextContent(render_options)
    .then(function(textContent: any) {
      let lastY, text = '';
      for (let item of textContent.items) {
        if (lastY == item.transform[5] || !lastY) {
          text += item.str;
        } else {
          text += '\n' + item.str;
        }
        lastY = item.transform[5];
      }
      return text;
    });
}