import { Buffer } from "buffer";
import mammoth from 'mammoth';
import { db } from "../db";
import { complianceDocuments } from "@shared/schema";
import { eq } from "drizzle-orm";

const MAX_CONTENT_LENGTH = 32000;

// Enhanced logging function
function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [FileAnalyzer] [${type.toUpperCase()}] ${message}`, context ? context : '');
}

// Enhanced text cleaning function with more thorough cleaning
function cleanTextContent(text: string): string {
  if (!text) return '';
  return text
    .replace(/\u0000/g, '') // Remove null characters
    .replace(/[\uFFFD\uFFFE\uFFFF]/g, '') // Remove replacement characters
    .replace(/[\u0000-\u001F]/g, ' ') // Replace control characters with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/<!DOCTYPE[^>]*>/gi, '') // Remove DOCTYPE declarations
    .replace(/<\/?[^>]+(>|$)/g, '') // Remove any HTML tags
    .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
    .replace(/&[a-z]+;/gi, ' ') // Remove HTML entities
    .replace(/<xml[^>]*>[\s\S]*?<\/xml>/gi, '') // Remove XML declarations
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '') // Remove CDATA sections
    .replace(/\{[^}]*\}/g, '') // Remove potential JSON/object literals
    .replace(/\[[^\]]*\]/g, '') // Remove potential array literals
    .trim();
}

export async function analyzePDFContent(buffer: Buffer, documentId: number): Promise<string> {
  try {
    log(`Starting document analysis${documentId !== -1 ? ` for document ${documentId}` : ''}`);

    // Ensure we have a valid buffer
    if (!Buffer.isBuffer(buffer)) {
      log('Invalid input: not a buffer', 'error');
      throw new Error('Invalid input: not a buffer');
    }

    if (buffer.length === 0) {
      log('Invalid input: empty buffer', 'error');
      throw new Error('Invalid input: empty buffer');
    }

    let textContent = '';
    const fileType = await detectFileType(buffer);
    log(`Detected file type: ${fileType}`);

    if (fileType === 'pdf') {
      log('Starting PDF parsing');
      try {
        const pdfParse = (await import('pdf-parse')).default;

        // Add PDF specific validation
        const pdfHeader = buffer.slice(0, 5).toString();
        if (!pdfHeader.startsWith('%PDF-')) {
          throw new Error('Invalid PDF format: Missing PDF header');
        }

        const data = await pdfParse(buffer, {
          max: 0, // No page limit
          version: 'v2.0.550'
        });

        textContent = data.text;
        log('PDF parsing completed successfully', 'info', { contentLength: textContent.length });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`PDF parsing failed: ${errorMessage}`, 'error', { error });
        throw new Error(`PDF parsing failed: ${errorMessage}`);
      }
    } else if (fileType === 'docx') {
      log('Starting Word document parsing');
      try {
        const result = await mammoth.extractRawText({ buffer });
        textContent = result.value;
        log('Word document parsing completed', 'info', { contentLength: textContent.length });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('Word document extraction error:', 'error', { error: errorMessage });
        throw new Error(`Failed to extract content from Word document: ${errorMessage}`);
      }
    } else {
      throw new Error('Unsupported file format. Please upload PDF or Word documents only.');
    }

    if (!textContent || textContent.trim().length === 0) {
      log('No valid content extracted from document', 'error');
      throw new Error('No valid content could be extracted from document');
    }

    log(`Raw content extracted, length: ${textContent.length}`);

    // Content cleaning
    textContent = cleanTextContent(textContent);

    // Truncate if necessary while preserving word boundaries
    if (textContent.length > MAX_CONTENT_LENGTH) {
      log(`Content exceeds maximum length, truncating from ${textContent.length} to ~${MAX_CONTENT_LENGTH} chars`);
      textContent = textContent.substring(0, MAX_CONTENT_LENGTH).replace(/\s+[^\s]*$/, '');
    }

    log(`Final content length: ${textContent.length}`);

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

        log('Database updated successfully');
      } catch (error) {
        const dbError = error instanceof Error ? error.message : String(error);
        log('Database update error:', 'error', { error: dbError });
        throw new Error('Failed to update document in database');
      }
    }

    return textContent;

  } catch (error) {
    const finalError = error instanceof Error ? error.message : String(error);
    log("Document analysis error:", 'error', { error: finalError });

    if (documentId !== -1) {
      try {
        await db
          .update(complianceDocuments)
          .set({ status: "ERROR" })
          .where(eq(complianceDocuments.id, documentId));
      } catch (dbError) {
        log('Failed to update error status:', 'error', { error: dbError });
      }
    }

    throw error;
  }
}

async function detectFileType(buffer: Buffer): Promise<'pdf' | 'docx'> {
  const header = buffer.slice(0, 4);
  log('Detecting file type', 'debug', { headerHex: header.toString('hex') });

  // Check for PDF signature (%PDF)
  if (buffer.indexOf(Buffer.from('%PDF')) === 0) {
    log('Detected PDF signature');
    return 'pdf';
  }

  // Check for DOCX (ZIP) signature
  if (header[0] === 0x50 && header[1] === 0x4B) {
    log('Detected DOCX signature');
    return 'docx';
  }

  // Check content type more thoroughly for PDF
  const content = buffer.toString('ascii', 0, 1000);
  if (content.includes('%PDF')) {
    log('Detected PDF content signature');
    return 'pdf';
  }

  log('Unsupported file format detected', 'error');
  throw new Error('Unsupported file format. Please upload PDF or Word documents only.');
}