import { Buffer } from "buffer";
import PDFNet from '@pdftron/pdfnet-node';
import { db } from "../db";
import { complianceDocuments } from "@shared/schema";
import { eq } from "drizzle-orm";
import mammoth from 'mammoth';

const MAX_CONTENT_LENGTH = 128000; // Increased for complex documents

// Enhanced logging function
function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [FileAnalyzer] [${type.toUpperCase()}] ${message}`, context ? context : '');
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

    let extractedText = '';
    const fileType = await detectFileType(buffer);
    log(`Detected file type: ${fileType}`);

    if (fileType === 'pdf') {
        try {
          // Initialize PDFTron
          await PDFNet.initialize();

          // Create document from buffer
          const doc = await PDFNet.PDFDoc.createFromBuffer(buffer);
          await doc.initSecurityHandler();

          const pageCount = await doc.getPageCount();
          log(`Processing PDF with ${pageCount} pages`);

          for (let i = 1; i <= pageCount; i++) {
            try {
              const page = await doc.getPage(i);
              const reader = await PDFNet.TextExtractor.create();
              await reader.begin(page);

              // Use advanced text extraction options
              const opts = await reader.getTextExtractorConfig();
              opts.setOutputFormat(1); // PDFNet.TextExtractorOutputFormat.XHTML
              opts.setPageSegmentationMode(1); // PDFNet.TextExtractorPageSegmentationMode.AUTO

              // Extract text with layout preservation
              const pageText = await reader.getAsXML(opts);

              // Process the XML to maintain formatting
              const cleanPageText = processExtractedText(pageText);
              extractedText += cleanPageText + '\n';

              log(`Successfully processed page ${i}`);
            } catch (pageError) {
              log(`Error processing page ${i}`, 'error', pageError);
              // Continue with next page even if current page fails
              continue;
            }
          }

          await doc.destroy();
          await PDFNet.terminate();

        } catch (pdfError) {
          log('PDF processing error', 'error', pdfError);
          throw new Error(`PDF processing failed: ${pdfError.message}`);
        }
    } else if (fileType === 'docx') {
      log('Starting Word document parsing');
      try {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
        log('Word document parsing completed', 'info', { contentLength: extractedText.length });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('Word document extraction error:', 'error', { error: errorMessage });
        throw new Error(`Failed to extract content from Word document: ${errorMessage}`);
      }
    } else {
      throw new Error('Unsupported file format. Please upload PDF or Word documents only.');
    }


    if (!extractedText || extractedText.trim().length === 0) {
      log('No valid content extracted from document', 'error');
      throw new Error('No valid content could be extracted from document');
    }

    log(`Raw content extracted, length: ${extractedText.length}`);

    // Content cleaning and formatting
    extractedText = formatExtractedText(extractedText);

    // Truncate if necessary while preserving word boundaries
    if (extractedText.length > MAX_CONTENT_LENGTH) {
      log(`Content exceeds maximum length, truncating from ${extractedText.length} to ~${MAX_CONTENT_LENGTH} chars`);
      extractedText = extractedText.substring(0, MAX_CONTENT_LENGTH).replace(/\s+[^\s]*$/, '');
    }

    log(`Final content length: ${extractedText.length}`);

    // Only update database if a valid document ID was provided
    if (documentId !== -1) {
      try {
        await db
          .update(complianceDocuments)
          .set({
            content: extractedText,
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

    return extractedText;

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

function processExtractedText(xmlText: string): string {
  return xmlText
    .replace(/<\/?[^>]+(>|$)/g, '') // Remove XML/HTML tags
    .replace(/&[a-z]+;/gi, ' ') // Convert HTML entities to spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function formatExtractedText(text: string): string {
  // Enhanced text cleaning and formatting
  const cleaned = text
    .replace(/\u0000/g, '') // Remove null bytes
    .replace(/[\uFFFD\uFFFE\uFFFF]/g, '') // Remove replacement characters
    .replace(/[\u0000-\u001F]/g, ' ') // Replace control characters
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs
    .replace(/\n{3,}/g, '\n\n') // Maximum two consecutive line breaks
    .trim();

  // Detect and preserve document structure (basic example - improve as needed)
  const sections = cleaned.split(/(?=\n\s*(?:\d+\.|\([a-z]\)|\([0-9]\)|[A-Z][A-Z\s]+:))/g);

  return sections
    .map(section => section.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}