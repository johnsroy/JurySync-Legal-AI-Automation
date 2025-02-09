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
      // Dynamic import to avoid initialization issues and use simpler parsing
      const pdfParse = (await import('pdf-parse')).default;
      try {
        const data = await pdfParse(buffer, {
          max: MAX_CONTENT_LENGTH,
          // Use minimal options to avoid parsing issues
          pagerender: undefined,
          version: undefined
        });
        textContent = data.text;
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        // Fallback to raw text extraction if parsing fails
        textContent = buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, '');
      }
    } else if (fileType === 'docx') {
      textContent = await extractWordContent(buffer);
    } else {
      throw new Error('Unsupported file format. Please upload PDF or Word documents only.');
    }

    console.log(`Raw content extracted, length: ${textContent.length}`);

    // Basic content cleaning
    textContent = textContent
      .replace(/\u0000/g, '') // Remove null characters
      .replace(/[\uFFFD\uFFFE\uFFFF]/g, '') // Remove replacement characters
      .replace(/[\u0000-\u001F]/g, ' ') // Replace control characters with spaces
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
  // More lenient file type detection
  const header = buffer.slice(0, 4);

  // Check for PDF signature
  if (buffer.includes(Buffer.from('%PDF'))) {
    return 'pdf';
  }

  // Check for DOCX (ZIP) signature
  if (header[0] === 0x50 && header[1] === 0x4B) {
    return 'docx';
  }

  // Default to PDF if we can't determine the type
  // This allows for more forgiving PDF parsing
  if (buffer.toString('ascii', 0, 1000).includes('DOCTYPE')) {
    return 'pdf';
  }

  throw new Error('Unsupported file format');
}

async function extractWordContent(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Word document extraction error:', error);
    // Fallback to basic text extraction
    return buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, '');
  }
}