import PDFDocument from "pdfkit";
import pdf from "pdf-parse/lib/pdf-parse.js";  // Use direct import to avoid test file loading
import { createWorker } from "tesseract.js";
import debug from "debug";
import { analyzeDocument } from "./anthropic";

const log = debug("app:pdf-service");

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

  private constructor() {}

  static getInstance(): PDFService {
    if (!PDFService.instance) {
      PDFService.instance = new PDFService();
    }
    return PDFService.instance;
  }

  async parseDocument(
    buffer: Buffer,
    documentId?: number,
  ): Promise<PDFParseResult> {
    try {
      log('Parsing PDF document...', { documentId });
      const startTime = Date.now();

      const data = await pdf(buffer);
      const isScanned = await this.isScannedDocument(data);

      let text = data.text;

      // If document is scanned and has little to no text, use OCR
      if (isScanned && text.trim().length < 100) {
        log('Document appears to be scanned, attempting OCR...', { documentId });
        const ocrResult = await this.processWithOCR(buffer);
        text = ocrResult.text;
      }

      // Analyze document content using Anthropic
      let analysis;
      try {
        analysis = await analyzeDocument(text);
        log('Document analysis completed', {
          documentId,
          classification: analysis.classification,
          confidence: analysis.confidence
        });
      } catch (analysisError) {
        log('Document analysis failed', { documentId, error: analysisError });
      }

      const processingTime = Date.now() - startTime;
      log('PDF parsing completed', {
        documentId,
        textLength: text.length,
        isScanned,
        processingTime,
        hasAnalysis: !!analysis
      });

      return {
        text,
        metadata: {
          info: data.info || {},
          pageCount: data.numpages || 1,
          isScanned,
          version: data.version,
          analysis
        },
      };
    } catch (error) {
      log("PDF parsing error:", error);
      if (error instanceof Error) {
        throw new Error(`Failed to parse PDF document: ${error.message}`);
      }
      throw new Error('Failed to parse PDF document: Unknown error');
    }
  }

  private async isScannedDocument(data: any): Promise<boolean> {
    try {
      const textDensity = data.text ? data.text.length / (data.numpages || 1) : 0;
      return textDensity < 100;
    } catch (error) {
      log('Error checking if document is scanned:', error);
      return false;
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
      log("OCR processing error:", error);
      throw new Error("Failed to process document with OCR");
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