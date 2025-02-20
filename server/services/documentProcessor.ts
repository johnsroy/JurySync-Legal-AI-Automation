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
  boundingBox?: BoundingBox;
}

interface TableInfo {
  pageNumber: number;
  rowCount: number;
  columnCount: number;
  data: string[][];
  boundingBox?: BoundingBox;
}

interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function logError(message: string, error: any) {
  console.error(`[DocumentProcessor] ${message}:`, {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString()
  });
}

export async function processDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ProcessingResult> {
  const startTime = Date.now();

  try {
    // Initialize PDFNet once for the entire processing
    await PDFNet.initialize();

    try {
      const result = await extractAndStructureContent(buffer, mimeType);

      if (!result.content) {
        throw new Error(`Content extraction failed for ${filename}`);
      }

      return {
        success: true,
        content: result.content,
        metadata: {
          ...result.metadata,
          processingTime: Date.now() - startTime,
          fileType: mimeType
        }
      };
    } finally {
      await PDFNet.terminate();
    }
  } catch (error: any) {
    logError(`Failed to process document ${filename}`, error);
    return {
      success: false,
      content: '',
      error: error.message
    };
  }
}

async function extractAndStructureContent(
  buffer: Buffer,
  mimeType: string
): Promise<{ content: string; metadata?: any }> {
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
  try {
    const doc = await PDFNet.PDFDoc.createFromBuffer(buffer);
    await doc.initSecurityHandler();

    const pageCount = await doc.getPageCount();
    const sections: Section[] = [];
    const tables: TableInfo[] = [];
    let fullContent = '';

    // Process each page
    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      if (!page) continue;

      // Extract text with layout information
      const textExtractor = await PDFNet.TextExtractor.create();
      await textExtractor.begin(page);

      // Get text with style information
      const words = await textExtractor.getWords();
      let pageText = '';
      let currentSection: Section = { content: '', pageNumber: i };

      // Process words with their style information
      for (const word of words) {
        const style = word.getStyle();
        const fontSize = style.getFontSize();
        const font = await style.getFont();
        const fontName = await font.getName();

        // Detect headers based on font size and style
        if (fontSize > 12 || fontName.includes('Bold') || fontName.includes('Header')) {
          if (currentSection.content) {
            sections.push(currentSection);
            currentSection = { content: '', pageNumber: i };
          }
          currentSection.title = word.getString();
        } else {
          currentSection.content += word.getString() + ' ';
          pageText += word.getString() + ' ';
        }
      }

      // Extract tables
      const tableExtractor = await PDFNet.TableExtractor.create();
      await tableExtractor.begin(page);

      const tableData = await tableExtractor.getTableData();
      if (tableData && tableData.length > 0) {
        for (const table of tableData) {
          const rows = await table.getRowCount();
          const cols = await table.getColumnCount();
          const data: string[][] = [];

          for (let r = 0; r < rows; r++) {
            const row: string[] = [];
            for (let c = 0; c < cols; c++) {
              const cell = await table.getCell(r, c);
              const text = await cell.getText();
              row.push(text);
            }
            data.push(row);
          }

          tables.push({
            pageNumber: i,
            rowCount: rows,
            columnCount: cols,
            data
          });
        }
      }

      if (currentSection.content) {
        sections.push(currentSection);
      }

      fullContent += pageText.trim() + '\n';
    }

    return {
      content: fullContent.trim(),
      metadata: {
        pageCount,
        method: 'pdftron-advanced',
        structure: {
          sections,
          tables
        }
      }
    };
  } catch (pdfTronError) {
    logError('PDFTron extraction failed, trying pdf-lib', pdfTronError);

    // Fallback to pdf-lib for simpler extraction
    try {
      const pdfDoc = await PDFDocument.load(buffer);
      const pages = pdfDoc.getPages();
      let content = '';

      for (const page of pages) {
        content += await page.getText() + '\n';
      }

      return {
        content: content.trim(),
        metadata: {
          pageCount: pages.length,
          method: 'pdf-lib'
        }
      };
    } catch (pdfLibError) {
      logError('pdf-lib extraction failed', pdfLibError);
      throw new Error('Failed to extract PDF content using both PDFTron and pdf-lib');
    }
  }
}

async function extractDocxContent(buffer: Buffer): Promise<{ content: string; metadata: any }> {
  try {
    const result = await mammoth.extractRawText({ buffer });
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