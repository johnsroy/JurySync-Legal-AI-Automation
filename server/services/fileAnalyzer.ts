import { Buffer } from "buffer";
import PDFNet from '@pdftron/pdfnet-node';
import { db } from "../db";
import { complianceDocuments } from "@shared/schema";
import { eq } from "drizzle-orm";

const MAX_CONTENT_LENGTH = 500000; // Increased for large documents

// Enhanced logging function
function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [FileAnalyzer] [${type.toUpperCase()}] ${message}`, context ? JSON.stringify(context) : '');
}

async function initializePDFNet(): Promise<void> {
  try {
    await PDFNet.PDFNet.initialize();
    log('PDFNet initialized successfully', 'info');
  } catch (error: any) {
    log('PDFNet initialization failed', 'error', error);
    throw new Error(`PDFNet initialization failed: ${error.message}`);
  }
}

export async function analyzePDFContent(buffer: Buffer, documentId: number = -1): Promise<string> {
  try {
    log(`Starting PDF analysis`, 'info', {
      documentId,
      bufferLength: buffer.length,
      timestamp: new Date().toISOString()
    });

    // Validate input
    if (!Buffer.isBuffer(buffer)) {
      log('Invalid input: not a buffer', 'error');
      throw new Error('Invalid input: not a buffer');
    }

    if (buffer.length === 0) {
      log('Invalid input: empty buffer', 'error');
      throw new Error('Invalid input: empty buffer');
    }

    let extractedText = '';

    try {
      await initializePDFNet();

      log('Creating PDF document from buffer...', 'info');
      const doc = await PDFNet.PDFDoc.createFromBuffer(buffer);

      log('Initializing security handler...', 'info');
      await doc.initSecurityHandler();

      const pageCount = await doc.getPageCount();
      log(`Processing PDF document`, 'info', { pageCount });

      for (let i = 1; i <= pageCount; i++) {
        try {
          log(`Processing page ${i}/${pageCount}`, 'debug');

          const page = await doc.getPage(i);
          const reader = await PDFNet.TextExtractor.create();
          await reader.begin(page);

          // Enhanced text extraction options
          const opts = await reader.getTextExtractorConfig();
          opts.setOutputFormat(1); // Use XHTML format
          opts.setPageSegmentationMode(1); // Use AUTO segmentation

          // Extract text with layout preservation
          const pageText = await reader.getAsXML(opts);

          // Clean and process the extracted text
          const cleanPageText = processExtractedText(pageText);
          extractedText += cleanPageText + '\n';

          log(`Successfully processed page ${i}`, 'debug', {
            pageTextLength: cleanPageText.length
          });
        } catch (pageError: any) {
          log(`Error processing page ${i}`, 'error', {
            error: pageError.message,
            stack: pageError.stack
          });
          // Continue with next page
          continue;
        }
      }

      log('Cleaning up PDFNet resources...', 'debug');
      await doc.destroy();
      await PDFNet.PDFNet.terminate();

    } catch (pdfError: any) {
      log('PDF processing error', 'error', {
        error: pdfError.message,
        stack: pdfError.stack,
        type: pdfError.constructor.name
      });
      throw new Error(`PDF processing failed: ${pdfError.message}`);
    }

    if (!extractedText || extractedText.trim().length === 0) {
      log('No valid content extracted from document', 'error');
      throw new Error('No valid content could be extracted from document');
    }

    log('Content extraction completed', 'info', {
      extractedLength: extractedText.length,
      previewStart: extractedText.substring(0, 100)
    });

    // Format and clean the extracted text
    extractedText = formatExtractedText(extractedText);

    // Handle large documents
    if (extractedText.length > MAX_CONTENT_LENGTH) {
      log(`Content exceeds maximum length, truncating...`, 'info', {
        originalLength: extractedText.length,
        maxLength: MAX_CONTENT_LENGTH
      });
      extractedText = extractedText
        .substring(0, MAX_CONTENT_LENGTH)
        .replace(/\s+[^\s]*$/, '')
        .trim();
    }

    log('Text processing completed', 'info', {
      finalLength: extractedText.length
    });

    return extractedText;

  } catch (error: any) {
    log('Fatal error in analyzePDFContent', 'error', {
      error: error.message,
      stack: error.stack,
      type: error.constructor.name
    });
    throw error;
  }
}

function processExtractedText(xmlText: string): string {
  // Remove XML/HTML tags while preserving content structure
  const cleaned = xmlText
    .replace(/<\/?[^>]+(>|$)/g, '\n') // Replace tags with newlines
    .replace(/&[a-z]+;/gi, ' ')       // Convert HTML entities to spaces
    .replace(/\s+/g, ' ')             // Normalize whitespace
    .split('\n')                      // Split into lines
    .map(line => line.trim())         // Trim each line
    .filter(Boolean)                  // Remove empty lines
    .join('\n');                      // Rejoin with newlines

  return cleaned;
}

function formatExtractedText(text: string): string {
  // Initial cleaning
  const cleaned = text
    .replace(/\u0000/g, '')                    // Remove null bytes
    .replace(/[\uFFFD\uFFFE\uFFFF]/g, '')      // Remove replacement chars
    .replace(/[\u0000-\u001F]/g, ' ')          // Replace control chars
    .replace(/\r\n/g, '\n')                    // Normalize line endings
    .replace(/[ \t]+/g, ' ')                   // Normalize spaces and tabs
    .replace(/\n{3,}/g, '\n\n')               // Max two consecutive breaks
    .trim();

  // Split into sections based on common document patterns
  const sections = cleaned.split(/(?=\n\s*(?:\d+\.|\([a-z]\)|\([0-9]\)|[A-Z][A-Z\s]+:))/g);

  // Process and rejoin sections
  return sections
    .map(section => section.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
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