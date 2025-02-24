import mammoth from "mammoth";
import { Buffer } from "buffer";
import PDFNet from "@pdftron/pdfnet-node";
import { PDFDocument } from "pdf-lib";
import debug from "debug";

const log = debug("app:document-processor");

export interface ProcessingResult {
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

export class DocumentProcessor {
  async processDocument(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      const result = await this.extractText(buffer, mimeType);

      return {
        success: true,
        content: result,
        metadata: {
          processingTime: Date.now() - startTime,
          fileType: mimeType,
          method: this.getProcessingMethod(mimeType),
        },
      };
    } catch (error: any) {
      log("ERROR in document processing:", error);
      return {
        success: false,
        content: "",
        error:
          error.message || "Unknown error occurred during document processing",
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
        const text = await page.getText();
        content += text + "\n";
      }

      return content.trim();
    } catch (error) {
      throw new Error("Failed to process PDF document");
    }
  }

  private async processWord(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error("Failed to process Word document");
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
