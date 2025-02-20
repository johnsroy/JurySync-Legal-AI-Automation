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
    structure?: {
      sections: Section[];
      tables: TableInfo[];
    };
  };
  error?: string;
}

interface Section {
  title?: string;
  content: string;
  pageNumber: number;
}

interface TableInfo {
  pageNumber: number;
  rowCount: number;
  columnCount: number;
  data: string[][];
}

function logError(message: string, error: any) {
  log('ERROR %s: %o', message, {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined
  });
}

export async function processDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ProcessingResult> {
  log('Processing document: %s (%s)', filename, mimeType);
  const startTime = Date.now();

  try {
    const result = await extractAndStructureContent(buffer, mimeType);

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
    logError(`Failed to process document ${filename}`, error);
    return {
      success: false,
      content: '',
      error: error.message || 'Unknown error occurred during document processing'
    };
  }
}

async function extractAndStructureContent(
  buffer: Buffer,
  mimeType: string
): Promise<{ content: string; metadata?: any }> {
  log('Extracting content for mimetype: %s', mimeType);

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
}

async function extractPDFContent(buffer: Buffer): Promise<{ content: string; metadata: any }> {
  log('Starting PDF content extraction');

  try {
    log('Initializing PDFTron');
    await PDFNet.initialize();

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

    } finally {
      await PDFNet.terminate();
    }

  } catch (pdfTronError) {
    logError('PDFTron extraction failed, falling back to pdf-lib', pdfTronError);

    try {
      log('Attempting extraction with pdf-lib');
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
      logError('PDF extraction failed with both methods', pdfLibError);
      throw new Error('Failed to extract PDF content using available methods');
    }
  }
}

async function extractDocxContent(buffer: Buffer): Promise<{ content: string; metadata: any }> {
  log('Starting DOCX content extraction');

  try {
    const result = await mammoth.extractRawText({ buffer });
    log('Successfully extracted DOCX content');

    return {
      content: result.value.trim(),
      metadata: {
        method: 'mammoth'
      }
    };
  } catch (error) {
    logError('DOCX extraction failed', error);
    throw error;
  }
}