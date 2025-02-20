import { Buffer } from "buffer";
import PDFNet from '@pdftron/pdfnet-node';
import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';

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

function logError(message: string, error: any) {
  console.error(`[DocumentProcessor] ${message}:`, {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined
  });
}

export async function processDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ProcessingResult> {
  const startTime = Date.now();
  let content: string | null = null;
  let pageCount: number | undefined;
  let method: string | undefined;

  try {
    content = await extractDocumentContent(buffer, mimeType);
    if (!content) {
      throw new Error(`Content extraction failed for ${filename}`);
    }

    if (mimeType === 'application/pdf') {
      const pdfDoc = await PDFDocument.load(buffer);
      pageCount = pdfDoc.getPageCount();
      method = 'pdf-lib';
    } else if (mimeType.includes('word')) {
      method = 'mammoth';
    } else {
      method = 'plaintext';
    }

    return {
      success: true,
      content,
      metadata: {
        pageCount,
        fileType: mimeType,
        processingTime: Date.now() - startTime,
        method
      }
    };
  } catch (error: any) {
    logError(`Failed to process document ${filename}`, error);
    return {
      success: false,
      content: '',
      error: error.message
    };
  }
}

export async function extractDocumentContent(
  buffer: Buffer,
  mimeType: string
): Promise<string | null> {
  try {
    switch (mimeType) {
      case 'application/pdf':
        return await extractPDFContent(buffer);

      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await extractDocxContent(buffer);

      case 'text/plain':
        return buffer.toString('utf-8');

      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    logError('Content extraction failed', error);
    return null;
  }
}

async function extractPDFContent(buffer: Buffer): Promise<string> {
  try {
    // Initialize PDFNet
    await PDFNet.initialize();

    try {
      const doc = await PDFNet.PDFDoc.createFromBuffer(buffer);
      await doc.initSecurityHandler();

      let extractedText = '';
      const pageCount = await doc.getPageCount();

      for (let i = 1; i <= pageCount; i++) {
        const page = await doc.getPage(i);
        if (!page) continue;

        const textExtractor = await PDFNet.TextExtractor.create();
        await textExtractor.begin(page);
        extractedText += await textExtractor.getAsText() + '\n';
      }

      return extractedText.trim();
    } finally {
      await PDFNet.terminate();
    }
  } catch (pdfTronError) {
    logError('PDFTron extraction failed, trying pdf-lib', pdfTronError);

    // Fallback to pdf-lib
    try {
      const pdfDoc = await PDFDocument.load(buffer);
      const pages = pdfDoc.getPages();
      let content = '';

      for (const page of pages) {
        content += await page.getText() + '\n';
      }

      return content.trim();
    } catch (pdfLibError) {
      logError('pdf-lib extraction failed', pdfLibError);
      throw new Error('Failed to extract PDF content using both PDFTron and pdf-lib');
    }
  }
}

async function extractDocxContent(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch (error) {
    logError('DOCX extraction failed', error);
    throw error;
  }
}