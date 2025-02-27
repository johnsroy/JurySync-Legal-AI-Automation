import PDFDocument from "pdfkit";
import { createWorker } from "tesseract.js";
import debug from "debug";
import { analyzeDocument } from "./anthropic";

const log = debug("app:pdf-service");

// Safely import pdf-parse to avoid test file loading
let pdfParse: any;
try {
  // Dynamically import to avoid test file loading during initialization
  pdfParse = require('pdf-parse/lib/pdf-parse.js');
} catch (error) {
  log('Warning: PDF parse module initialization error:', error);
  pdfParse = async (buffer: Buffer) => {
    throw new Error('PDF parsing module not available');
  };
}

export interface PDFParseResult {
  text: string;
  metadata: {
    info: any;
    pageCount: number;
    isScanned: boolean;
    version?: string;
    analysis?: any;
  };
}

export interface OCRResult {
  text: string;
  confidence: number;
}

export class PDFService {
  private static instance: PDFService;
  private ocrWorker: Tesseract.Worker | null = null;

  private constructor() {
    log('Initializing PDF Service...');
  }

  static getInstance(): PDFService {
    if (!PDFService.instance) {
      PDFService.instance = new PDFService();
    }
    return PDFService.instance;
  }

  async parseDocument(buffer: Buffer): Promise<PDFParseResult> {
    try {
      log('Starting PDF parsing...');
      const startTime = Date.now();

      if (!buffer || buffer.length === 0) {
        throw new Error('Invalid PDF buffer provided');
      }

      // Safely parse PDF with error handling
      let data;
      try {
        data = await pdfParse(buffer);
      } catch (parseError) {
        log('PDF parsing error:', parseError);
        throw new Error('Failed to parse PDF document');
      }

      let text = data?.text || '';
      const isScanned = await this.isScannedDocument(data);

      // Attempt OCR if needed
      if (isScanned && text.trim().length < 100) {
        log('Document appears to be scanned, attempting OCR...');
        const ocrResult = await this.processWithOCR(buffer);
        text = ocrResult.text;
      }

      // Analyze content if available
      let analysis = null;
      if (text.trim().length > 0) {
        try {
          analysis = await analyzeDocument(text);
          log('Document analysis completed successfully');
        } catch (analysisError) {
          log('Content analysis failed:', analysisError);
          // Continue without analysis
        }
      }

      const processingTime = Date.now() - startTime;
      log('PDF processing completed', {
        textLength: text.length,
        isScanned,
        processingTime,
        hasAnalysis: !!analysis
      });

      return {
        text,
        metadata: {
          info: data?.info || {},
          pageCount: data?.numpages || 1,
          isScanned,
          version: data?.version,
          analysis
        },
      };
    } catch (error) {
      log('PDF parsing error:', error);
      throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async isScannedDocument(data: any): Promise<boolean> {
    try {
      if (!data || !data.text) return true;
      const textDensity = data.text.length / (data.numpages || 1);
      return textDensity < 100;
    } catch (error) {
      log('Error checking document type:', error);
      return true; // Assume scanned if we can't determine
    }
  }

  async processWithOCR(buffer: Buffer): Promise<OCRResult> {
    try {
      if (!this.ocrWorker) {
        this.ocrWorker = await createWorker({
          logger: m => log('Tesseract:', m)
        });
      }

      const { data } = await this.ocrWorker.recognize(buffer);
      return {
        text: data.text,
        confidence: data.confidence,
      };
    } catch (error) {
      log('OCR processing error:', error);
      throw new Error('OCR processing failed');
    }
  }

  async generatePDF(content: string, options: any = {}): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument(options);
        const chunks: Buffer[] = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', err => reject(err));

        doc.fontSize(12).text(content);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  async cleanup(): Promise<void> {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate();
      this.ocrWorker = null;
    }
  }
}

export const pdfService = PDFService.getInstance();