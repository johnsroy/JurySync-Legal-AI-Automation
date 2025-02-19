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

  while (attempts < MAX_RETRIES) {
    attempts++;
    try {
      log(`Attempt ${attempts} to process document`, 'info', { filename });

      // Try PDFTron first
      try {
        const result = await processPDFWithPDFTron(buffer);
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
        log('PDFTron processing failed, trying fallback method', 'error', { error: pdfTronError });
      }

      // Fallback to pdf-lib
      try {
        const result = await processPDFWithPDFLib(buffer);
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
        log('pdf-lib processing failed, trying Python fallback', 'error', { error: pdfLibError });
      }

      // Final fallback to Python processing
      const result = await processPDFWithPython(buffer);
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
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }

  throw new Error(`Failed to process document after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

async function processPDFWithPDFTron(buffer: Buffer): Promise<ProcessingResult> {
  await PDFNet.initialize();
  
  try {
    const doc = await PDFNet.PDFDoc.createFromBuffer(buffer);
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

    await doc.destroy();
    await PDFNet.terminate();

    return {
      success: true,
      content: extractedText,
      metadata: { pageCount }
    };
  } catch (error) {
    await PDFNet.terminate();
    throw error;
  }
}

async function processPDFWithPDFLib(buffer: Buffer): Promise<ProcessingResult> {
  const pdfDoc = await PDFDocument.load(buffer);
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
      scriptPath: './server/scripts',
      args: [buffer.toString('base64')]
    };

    PythonShell.run('pdf_processor.py', options).then(results => {
      if (results && results.length > 0) {
        const result = JSON.parse(results[0]);
        resolve({
          success: true,
          content: cleanExtractedText(result.text),
          metadata: { pageCount: result.pageCount }
        });
      } else {
        reject(new Error('No output from Python processor'));
      }
    }).catch(reject);
  });
}

function cleanExtractedText(text: string): string {
  return text
    .replace(/<\/?[^>]+(>|$)/g, '\n')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}
