import { Buffer } from "buffer";
import PDFNet from '@pdftron/pdfnet-node';
import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';
import util from 'util';
import debug from 'debug';

const log = debug('jurysync:document-processor');

interface ProcessingResult {
  success: boolean;
  content: string;
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
    const result = await extractContent(buffer, mimeType);

    if (!result.content) {
      throw new Error(`Content extraction failed for ${filename}`);
    }

    log('Successfully extracted content from %s', filename);

    return {
      success: true,
      content: result.content,
      metadata: {
        ...result.metadata,
        processingTime: Date.now() - startTime,
        fileType: mimeType
      }
    };
  } catch (error: any) {
    log('ERROR in document processing: %o', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      success: false,
      content: '',
      error: error.message || 'Unknown error occurred during document processing'
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
        return { content: buffer.toString('utf-8') };
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
    // Initialize PDFTron with proper error handling
    try {
      await PDFNet.initialize();
    } catch (initError) {
      log('PDFTron initialization failed: %o', initError);
      throw new Error('Failed to initialize PDF processor');
    }

    try {
      const doc = await PDFNet.PDFDoc.createFromBuffer(buffer);
      await doc.initSecurityHandler();

      const pageCount = await doc.getPageCount();
      let extractedText = '';

      log('Processing %d pages', pageCount);

      for (let i = 1; i <= pageCount; i++) {
        const page = await doc.getPage(i);
        if (!page) {
          log('Warning: Could not access page %d', i);
          continue;
        }

        const textExtractor = await PDFNet.TextExtractor.create();
        await textExtractor.begin(page);
        const text = await textExtractor.getAsText();
        extractedText += text + '\n';
      }

      log('Successfully extracted text using PDFTron');

      return {
        content: extractedText.trim(),
        metadata: {
          pageCount,
          method: 'pdftron'
        }
      };

    } catch (pdfTronError) {
      log('PDFTron extraction failed: %o', pdfTronError);
      throw pdfTronError;
    } finally {
      await PDFNet.terminate();
    }

  } catch (error) {
    // Fallback to pdf-lib
    log('Attempting fallback with pdf-lib');
    try {
      const pdfDoc = await PDFDocument.load(buffer);
      const pages = pdfDoc.getPages();
      let content = '';

      for (const page of pages) {
        const text = await page.getText();
        content += text + '\n';
      }

      log('Successfully extracted text using pdf-lib');

      return {
        content: content.trim(),
        metadata: {
          pageCount: pages.length,
          method: 'pdf-lib'
        }
      };
    } catch (pdfLibError) {
      log('PDF extraction failed with both methods');
      throw new Error('Failed to extract PDF content using available methods');
    }
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