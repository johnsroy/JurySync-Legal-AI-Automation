import { Buffer } from "buffer";
import PDFNet from '@pdftron/pdfnet-node';
import { PDFDocument } from 'pdf-lib';
import { PythonShell } from 'python-shell';
import path from 'path';
import { db } from "../db";
import { documents } from "@shared/schema";
import { eq } from "drizzle-orm";

const MAX_RETRIES = 3;
const TIMEOUT = 30000; // 30 seconds

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

function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DocumentProcessor] [${type.toUpperCase()}] ${message}`, 
    context ? JSON.stringify(context, null, 2) : '');
}

export async function processDocument(buffer: Buffer, filename: string): Promise<ProcessingResult> {
  const startTime = Date.now();
  let attempts = 0;
  let lastError: Error | null = null;

  log('Starting document processing', 'info', { filename, bufferSize: buffer.length });

  while (attempts < MAX_RETRIES) {
    attempts++;
    try {
      log(`Attempt ${attempts} to process document`, 'info', { filename });

      // Try PDFTron first
      try {
        log('Attempting PDFTron processing', 'info');
        const result = await processPDFWithPDFTron(buffer);
        log('PDFTron processing successful', 'info');
        return {
          success: true,
          content: result.content,
          metadata: {
            ...result.metadata,
            processingTime: Date.now() - startTime,
            method: 'PDFTron'
          }
        };
      } catch (pdfTronError) {
        log('PDFTron processing failed, trying fallback method', 'error', { 
          error: pdfTronError.message,
          stack: pdfTronError.stack 
        });
      }

      // Fallback to pdf-lib
      try {
        log('Attempting pdf-lib processing', 'info');
        const result = await processPDFWithPDFLib(buffer);
        log('pdf-lib processing successful', 'info');
        return {
          success: true,
          content: result.content,
          metadata: {
            ...result.metadata,
            processingTime: Date.now() - startTime,
            method: 'pdf-lib'
          }
        };
      } catch (pdfLibError) {
        log('pdf-lib processing failed, trying Python fallback', 'error', { 
          error: pdfLibError.message,
          stack: pdfLibError.stack 
        });
      }

      // Final fallback to Python processing
      log('Attempting Python processing', 'info');
      const result = await processPDFWithPython(buffer);
      log('Python processing successful', 'info');
      return {
        success: true,
        content: result.content,
        metadata: {
          ...result.metadata,
          processingTime: Date.now() - startTime,
          method: 'Python-PyPDF2'
        }
      };

    } catch (error: any) {
      lastError = error;
      log(`Attempt ${attempts} failed`, 'error', {
        error: error.message,
        stack: error.stack
      });

      if (attempts < MAX_RETRIES) {
        const delay = 1000 * attempts;
        log(`Waiting ${delay}ms before next attempt`, 'info');
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  log('All processing attempts failed', 'error', { 
    attempts,
    lastError: lastError?.message
  });

  throw new Error(`Failed to process document after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

async function processPDFWithPDFTron(buffer: Buffer): Promise<ProcessingResult> {
  let doc;
  try {
    await PDFNet.initialize();
    doc = await PDFNet.PDFDoc.createFromBuffer(buffer);
    await doc.initSecurityHandler();

    const pageCount = await doc.getPageCount();
    let extractedText = '';

    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const reader = await PDFNet.TextExtractor.create();
      await reader.begin(page);

      const opts = await reader.getTextExtractorConfig();
      opts.setOutputFormat(1);
      opts.setPageSegmentationMode(1);

      const text = await reader.getAsXML(opts);
      extractedText += cleanExtractedText(text) + '\n';
    }

    return {
      success: true,
      content: extractedText,
      metadata: { pageCount }
    };
  } catch (error) {
    throw error;
  } finally {
    if (doc) {
      await doc.destroy();
    }
    await PDFNet.terminate();
  }
}

async function processPDFWithPDFLib(buffer: Buffer): Promise<ProcessingResult> {
  const pdfDoc = await PDFDocument.load(buffer, { 
    ignoreEncryption: true,
    updateMetadata: false
  });

  const pageCount = pdfDoc.getPageCount();
  let content = '';

  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.getPages()[i];
    const text = await page.getText();
    content += text + '\n';
  }

  return {
    success: true,
    content: cleanExtractedText(content),
    metadata: { pageCount }
  };
}

async function processPDFWithPython(buffer: Buffer): Promise<ProcessingResult> {
  return new Promise((resolve, reject) => {
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(process.cwd(), 'server', 'scripts'),
      args: [buffer.toString('base64')]
    };

    log('Starting Python PDF processor', 'debug', { scriptPath: options.scriptPath });

    PythonShell.run('pdf_processor.py', options).then(results => {
      if (results && results.length > 0) {
        try {
          const result = JSON.parse(results[0]);
          if (!result.success) {
            throw new Error(result.error || 'Python processing failed');
          }
          resolve({
            success: true,
            content: cleanExtractedText(result.text),
            metadata: { pageCount: result.pageCount }
          });
        } catch (parseError) {
          reject(new Error(`Failed to parse Python processor output: ${parseError.message}`));
        }
      } else {
        reject(new Error('No output from Python processor'));
      }
    }).catch(reject);
  });
}

function cleanExtractedText(text: string): string {
  return text
    .replace(/<\/?[^>]+(>|$)/g, '\n') // Remove XML/HTML tags
    .replace(/&[a-z]+;/gi, ' ')       // Convert HTML entities to spaces
    .replace(/\s+/g, ' ')             // Normalize whitespace
    .split('\n')                      // Split into lines
    .map(line => line.trim())         // Trim each line
    .filter(Boolean)                  // Remove empty lines
    .join('\n')                       // Rejoin with newlines
    .trim();                          // Trim final result
}