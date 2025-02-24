import PDFDocument from "pdfkit";
import pdf from "pdf-parse/lib/pdf-parse";  // Import directly from lib to avoid test file loading
import { createWorker } from "tesseract.js";
import debug from "debug";
import { Readable } from "stream";

const log = debug("app:pdf-service");

export interface PDFParseResult {
  text: string;
  metadata: {
    info: any;
    pageCount: number;
    isScanned: boolean;
    version?: string;
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
      const data = await pdf(buffer);
      const isScanned = await this.isScannedDocument(data);

      let text = data.text;

      // If document is scanned and has little to no text, use OCR
      if (isScanned && text.trim().length < 100) {
        const ocrResult = await this.processWithOCR(buffer);
        text = ocrResult.text;
      }

      return {
        text,
        metadata: {
          info: data.info || {},
          pageCount: data.numpages || 0,
          isScanned,
          version: data.version,
        },
      };
    } catch (error: any) {
      log("PDF parsing error:", error.message);
      throw new Error(`Failed to parse PDF document: ${error.message}`);
    }
  }

  private async isScannedDocument(data: any): Promise<boolean> {
    const textDensity = data.text.length / (data.numpages || 1);
    return textDensity < 100;
  }

  async processWithOCR(buffer: Buffer): Promise<OCRResult> {
    try {
      if (!this.ocrWorker) {
        this.ocrWorker = await createWorker("eng");
      }

      const { data } = await this.ocrWorker.recognize(buffer);
      return {
        text: data.text,
        confidence: data.confidence,
      };
    } catch (error: any) {
      log("OCR processing error:", error.message);
      throw new Error("Failed to process document with OCR");
    }
  }

  async generatePDF(content: string, options: any = {}): Promise<typeof PDFDocument> {
    const doc = new PDFDocument(options);
    doc.fontSize(12).text(content);
    return doc;
  }

  async cleanup(): Promise<void> {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate();
      this.ocrWorker = null;
    }
  }
}

export const pdfService = PDFService.getInstance();