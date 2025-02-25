import mammoth from "mammoth";
import { Buffer } from "buffer";
import PDFNet from "@pdftron/pdfnet-node";
import { PDFDocument } from "pdf-lib";
import debug from "debug";

const log = debug("app:document-processor");

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks for processing

export interface ProcessingResult {
  success: boolean;
  content: string;
  metadata?: {
    pageCount?: number;
    fileType?: string;
    processingTime?: number;
    method?: string;
    chunkProcessing?: {
      totalChunks: number;
      processedChunks: number;
      errors?: string[];
    };
  };
  error?: string;
}

export class DocumentProcessor {
  async processDocument(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Validate input
      if (!buffer || buffer.length === 0) {
        throw new Error("Empty document buffer");
      }

      if (buffer.length > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      }

      const result = await this.extractText(buffer, mimeType);

      return {
        success: true,
        content: result,
        metadata: {
          processingTime: Date.now() - startTime,
          fileType: mimeType,
          method: this.getProcessingMethod(mimeType),
          chunkProcessing: {
            totalChunks: Math.ceil(buffer.length / CHUNK_SIZE),
            processedChunks: Math.ceil(buffer.length / CHUNK_SIZE),
            errors: errors.length > 0 ? errors : undefined
          }
        },
      };
    } catch (error: any) {
      log("ERROR in document processing:", error);
      return {
        success: false,
        content: "",
        error: error.message || "Unknown error occurred during document processing",
        metadata: {
          processingTime: Date.now() - startTime,
          fileType: mimeType,
          method: this.getProcessingMethod(mimeType),
        }
      };
    }
  }

  async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      switch (mimeType) {
        case "application/pdf":
          return await this.processPDF(buffer);
        case "application/msword":
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          return await this.processWord(buffer);
        case "text/plain":
          return buffer.toString("utf-8");
        default:
          throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      log("Text extraction error:", error);
      throw new Error("Failed to extract text from document");
    }
  }

  private async processPDF(buffer: Buffer): Promise<string> {
    try {
      const pdfDoc = await PDFDocument.load(buffer);
      const pages = pdfDoc.getPages();
      let content = "";

      for (const page of pages) {
        try {
          const text = await page.getText();
          content += text + "\n";
        } catch (pageError: any) {
          log("Error processing PDF page:", pageError);
          // Continue processing other pages
          content += "[Error extracting page content]\n";
        }
      }

      if (!content.trim()) {
        throw new Error("No text content could be extracted from PDF");
      }

      return content.trim();
    } catch (error: any) {
      throw new Error(`Failed to process PDF document: ${error.message}`);
    }
  }

  private async processWord(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });

      if (!result.value.trim()) {
        throw new Error("No text content could be extracted from Word document");
      }

      return result.value;
    } catch (error: any) {
      throw new Error(`Failed to process Word document: ${error.message}`);
    }
  }

  private getProcessingMethod(mimeType: string): string {
    switch (mimeType) {
      case "application/pdf":
        return "pdf-lib";
      case "application/msword":
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return "mammoth";
      case "text/plain":
        return "text";
      default:
        return "unknown";
    }
  }
}

export const documentProcessor = new DocumentProcessor();