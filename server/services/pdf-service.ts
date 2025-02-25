import PDFDocument from "pdfkit";
import pdf from "pdf-parse/lib/pdf-parse";  // Import directly from lib to avoid test file loading
import { createWorker } from "tesseract.js";
import debug from "debug";
import { Readable } from "stream";

const log = debug("app:pdf-service");

const MAX_PAGE_SIZE = 500 * 1024 * 1024; // Increased to 500MB per page limit
const MAX_OCR_ATTEMPTS = 3;
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks for processing

export interface PDFParseResult {
  text: string;
  metadata: {
    info: any;
    pageCount: number;
    isScanned: boolean;
    version?: string;
    processingDetails?: {
      timePerPage?: number[];
      totalTime?: number;
      ocrRequired?: boolean;
      errors?: string[];
      chunks?: number;
      chunkSizes?: number[];
    };
  };
}

export interface OCRResult {
  text: string;
  confidence: number;
}

export class PDFService {
  private static instance: PDFService;
  private ocrWorker: Tesseract.Worker | null = null;
  private processingErrors: string[] = [];

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
    const startTime = Date.now();
    this.processingErrors = [];
    const chunkSizes: number[] = [];

    try {
      // Basic validation
      if (!buffer || buffer.length === 0) {
        throw new Error("Invalid PDF buffer");
      }

      log(`Processing PDF of size: ${buffer.length} bytes`);

      // Process large files in chunks if needed
      const chunks = Math.ceil(buffer.length / CHUNK_SIZE);
      let text = "";
      let info = {};
      let pageCount = 0;
      let version = "";

      if (chunks > 1) {
        log(`Processing large PDF in ${chunks} chunks`);
        for (let i = 0; i < chunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, buffer.length);
          const chunk = buffer.slice(start, end);
          chunkSizes.push(chunk.length);

          const chunkResult = await pdf(chunk, {
            max: MAX_PAGE_SIZE,
            pagerender: this.customPageRenderer.bind(this),
          });

          text += chunkResult.text + " ";
          info = { ...info, ...chunkResult.info };
          pageCount += chunkResult.numpages || 0;
          version = chunkResult.version || version;
        }
      } else {
        const data = await pdf(buffer, {
          max: MAX_PAGE_SIZE,
          pagerender: this.customPageRenderer.bind(this),
        });
        text = data.text;
        info = data.info || {};
        pageCount = data.numpages || 0;
        version = data.version;
      }

      const isScanned = await this.isScannedDocument(text, pageCount);

      // If document is scanned and has little to no text, use OCR
      if (isScanned && text.trim().length < 100) {
        log("Scanned document detected, attempting OCR");
        try {
          const ocrResult = await this.processWithOCR(buffer);
          text = ocrResult.text;
        } catch (ocrError: any) {
          this.processingErrors.push(`OCR processing failed: ${ocrError.message}`);
          // Fall back to any text we could extract
          if (!text) {
            text = ""; // Ensure we always return a string
          }
        }
      }

      // Validate final text content
      if (!text || text.trim().length === 0) {
        throw new Error("No text content could be extracted from the PDF");
      }

      return {
        text: text.trim(),
        metadata: {
          info,
          pageCount,
          isScanned,
          version,
          processingDetails: {
            timePerPage: [],
            totalTime: Date.now() - startTime,
            ocrRequired: isScanned,
            errors: this.processingErrors,
            chunks: chunks,
            chunkSizes: chunkSizes
          }
        },
      };
    } catch (error: any) {
      log("PDF parsing error:", error.message);
      throw new Error(`Failed to parse PDF document: ${error.message}`);
    }
  }

  private async customPageRenderer(pageData: any): Promise<string> {
    try {
      const startTime = Date.now();
      const text = await pageData.getTextContent();
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      log(`Page processed in ${processingTime}ms`);

      return text;
    } catch (error: any) {
      this.processingErrors.push(`Page rendering failed: ${error.message}`);
      return "";
    }
  }

  private async isScannedDocument(text: string, pageCount: number): Promise<boolean> {
    try {
      const textDensity = text.length / (pageCount || 1);
      return textDensity < 100;
    } catch (error: any) {
      this.processingErrors.push(`Scanned document detection failed: ${error.message}`);
      return false;
    }
  }

  async processWithOCR(buffer: Buffer): Promise<OCRResult> {
    let attempts = 0;

    while (attempts < MAX_OCR_ATTEMPTS) {
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
        attempts++;
        log(`OCR attempt ${attempts} failed:`, error.message);

        if (attempts === MAX_OCR_ATTEMPTS) {
          throw new Error("Failed to process document with OCR after maximum attempts");
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error("OCR processing failed");
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