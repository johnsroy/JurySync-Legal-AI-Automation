import { Buffer } from "buffer";
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
      console.log('PDF parsing started');
      try {
        const data = await pdfParse(buffer);
        textContent = data.text;
        console.log('PDF parsing completed successfully');
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        throw new Error(`PDF parsing failed: ${pdfError.message}`);
      }
    } else if (fileType === 'docx') {
      console.log('Word document parsing started');
      textContent = await extractWordContent(buffer);
      console.log('Word document parsing completed');
    } else {
      throw new Error('Unsupported file format. Please upload PDF or Word documents only.');
    }

    if (!textContent || textContent.trim().length === 0) {
      throw new Error('No valid content could be extracted from document');
    }

    console.log(`Raw content extracted, length: ${textContent.length}`);

    // Basic content cleaning
    textContent = textContent
      .replace(/\u0000/g, '') // Remove null characters
      .replace(/[\uFFFD\uFFFE\uFFFF]/g, '') // Remove replacement characters
      .replace(/[\u0000-\u001F]/g, ' ') // Replace control characters with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

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

    throw error;
  }
}

async function detectFileType(buffer: Buffer): Promise<'pdf' | 'docx'> {
  const header = buffer.slice(0, 4);

  // Check for PDF signature (%PDF)
  if (buffer.indexOf(Buffer.from('%PDF')) === 0) {
    return 'pdf';
  }

  // Check for DOCX (ZIP) signature
  if (header[0] === 0x50 && header[1] === 0x4B) {
    return 'docx';
  }

  // Check content type more thoroughly for PDF
  const content = buffer.toString('ascii', 0, 1000);
  if (content.includes('%PDF')) {
    return 'pdf';
  }

  throw new Error('Unsupported file format. Please upload PDF or Word documents only.');
}

async function extractWordContent(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Word document extraction error:', error);
    throw new Error('Failed to extract content from Word document');
  }
}