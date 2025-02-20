import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';
import debug from 'debug';

const log = debug('jurysync:document-processor');

interface ProcessingResult {
  success: boolean;
  content?: string;
  metadata?: {
    pageCount?: number;
    fileType?: string;
    processingTime?: number;
    method?: string;
  };
  error?: string;
}

export async function processDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ProcessingResult> {
  log('Processing document: %s (%s)', filename, mimeType);
  const startTime = Date.now();

  try {
    // Extract content
    const result = await extractContent(buffer, mimeType);

    if (!result.content) {
      throw new Error(`Content extraction failed for ${filename}`);
    }

    return {
      success: true,
      content: result.content,
      metadata: {
        ...result.metadata,
        processingTime: Date.now() - startTime,
        fileType: mimeType,
      }
    };
  } catch (error: any) {
    log('ERROR in document processing: %o', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Document processing failed'
    };
  }
}

async function extractContent(
  buffer: Buffer,
  mimeType: string
): Promise<{ content: string; metadata?: any }> {
  log('Extracting content for mimetype: %s', mimeType);

  try {
    switch (mimeType) {
      case 'application/pdf':
        return await extractPDFContent(buffer);
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await extractDocxContent(buffer);
      case 'text/plain':
        return { 
          content: buffer.toString('utf-8'),
          metadata: {
            method: 'text'
          }
        };
      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    log('Extraction error: %o', error);
    throw error;
  }
}

async function extractPDFContent(buffer: Buffer): Promise<{ content: string; metadata: any }> {
  log('Starting PDF content extraction');

  try {
    const pdfDoc = await PDFDocument.load(buffer);
    const pages = pdfDoc.getPages();
    let content = '';

    // Basic text extraction - this is a simplified approach
    for (const page of pages) {
      const text = page.getTextContent?.() || '';
      content += text + '\n\n';
    }

    log('Successfully extracted text from PDF');

    return {
      content: content.trim() || 'PDF content extraction limited. Please try OCR for better results.',
      metadata: {
        pageCount: pages.length,
        method: 'pdf-lib'
      }
    };
  } catch (error) {
    log('PDF extraction failed: %o', error);
    throw new Error('Failed to extract PDF content');
  }
}

async function extractDocxContent(buffer: Buffer): Promise<{ content: string; metadata: any }> {
  log('Starting DOCX content extraction');

  try {
    const result = await mammoth.extractRawText({ buffer });

    if (!result.value) {
      throw new Error('Failed to extract content from DOCX file');
    }

    log('Successfully extracted DOCX content');

    return {
      content: result.value.trim(),
      metadata: {
        method: 'mammoth'
      }
    };
  } catch (error) {
    log('DOCX extraction failed: %o', error);
    throw error;
  }
}