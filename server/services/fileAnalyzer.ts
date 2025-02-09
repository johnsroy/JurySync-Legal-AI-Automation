import { Buffer } from "buffer";
import mammoth from 'mammoth';
import { db } from "../db";
import { complianceDocuments } from "@shared/schema";
import { eq } from "drizzle-orm";
import { default as pdfParseLib } from 'pdf-parse';

// Wrapper function to handle PDF parsing without test files
const pdfParse = async (dataBuffer: Buffer) => {
  try {
    return await pdfParseLib(dataBuffer, {
      pagerender: null, // Disable page rendering completely
      version: false, // Skip version check
      max: 0, // No page limit
      disableCopyPaste: true, // Disable copy-paste functionality
    });
  } catch (error) {
    console.error('PDF parse error:', error);
    throw new Error('Failed to parse PDF document');
  }
};

const MAX_CONTENT_LENGTH = 32000;

export async function analyzePDFContent(buffer: Buffer, documentId: number): Promise<string> {
  try {
    console.log(`Starting document analysis${documentId !== -1 ? ` for document ${documentId}` : ''}`);

    let textContent = '';
    const fileType = await detectFileType(buffer);

    if (fileType === 'pdf') {
      try {
        console.log('Parsing PDF document...');
        const data = await pdfParse(buffer);
        textContent = data.text || '';
        console.log('PDF parsing successful, extracted text length:', textContent.length);
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        throw new Error(`Failed to parse PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
      }
    } else if (fileType === 'docx') {
      textContent = await extractWordContent(buffer);
    } else {
      throw new Error('Unsupported file format. Please upload PDF or Word documents only.');
    }

    if (!textContent || textContent.trim().length === 0) {
      throw new Error('No text content could be extracted from the document');
    }

    console.log('Raw content extracted, length:', textContent.length);

    // Clean and normalize the text content
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
  try {
    // Check for PDF signature
    if (buffer.toString('ascii', 0, 5).includes('%PDF')) {
      return 'pdf';
    }

    // Check for DOCX (ZIP) signature
    if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
      return 'docx';
    }

    // Check for content type in the first few bytes
    const content = buffer.toString('ascii', 0, 1000);

    if (content.includes('<!DOCTYPE') || content.includes('<html')) {
      throw new Error('HTML files are not supported. Please upload PDF or Word documents only.');
    }

    throw new Error('Unsupported file format. Please upload PDF or Word documents only.');
  } catch (error) {
    console.error('File type detection error:', error);
    throw new Error('Unable to determine file type. Please ensure you are uploading a valid PDF or Word document.');
  }
}

async function extractWordContent(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    if (!text) {
      throw new Error('No text content found in Word document');
    }
    return text;
  } catch (error) {
    console.error('Word document extraction error:', error);
    throw new Error('Failed to extract content from Word document');
  }
}