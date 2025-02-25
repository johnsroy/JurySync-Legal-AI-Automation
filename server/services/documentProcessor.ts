import mammoth from "mammoth";
import { Buffer } from "buffer";
import debug from "debug";
import { pdfService } from "./pdf-service";

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
      log('Processing document:', { filename, mimeType });
      const content = await this.extractText(buffer, mimeType);

      if (!content || content.trim().length === 0) {
        throw new Error('No text content could be extracted from document');
      }

      const processingTime = Date.now() - startTime;
      log('Document processed successfully:', {
        filename,
        contentLength: content.length,
        processingTime
      });

      return {
        success: true,
        content,
        metadata: {
          processingTime,
          fileType: mimeType,
          method: this.getProcessingMethod(mimeType),
        },
      };
    } catch (error: any) {
      log("ERROR in document processing:", error);
      return {
        success: false,
        content: "",
        error: error.message || "Unknown error occurred during document processing",
      };
    }
  }

  async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      log('Extracting text from document:', { mimeType });
      let content: string;

      switch (mimeType) {
        case "application/pdf":
          content = await this.processPDF(buffer);
          break;
        case "application/msword":
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          content = await this.processWord(buffer);
          break;
        case "text/plain":
          content = buffer.toString("utf-8");
          break;
        default:
          throw new Error(`Unsupported file type: ${mimeType}`);
      }

      if (!content || content.trim().length === 0) {
        throw new Error(`No text content could be extracted from ${mimeType} document`);
      }

      log('Text extraction successful:', {
        mimeType,
        contentLength: content.length
      });

      return content;
    } catch (error) {
      log("Text extraction error:", error);
      throw new Error(`Failed to extract text from document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processPDF(buffer: Buffer): Promise<string> {
    try {
      log('Processing PDF document...');
      const result = await pdfService.parseDocument(buffer);

      if (!result.text || result.text.trim().length === 0) {
        throw new Error('No text content extracted from PDF');
      }

      log('PDF processing successful:', {
        contentLength: result.text.length
      });

      return result.text;
    } catch (error) {
      log('PDF processing error:', error);
      throw new Error(`Failed to process PDF document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processWord(buffer: Buffer): Promise<string> {
    try {
      log('Processing Word document...');
      const result = await mammoth.extractRawText({ buffer });

      if (!result.value || result.value.trim().length === 0) {
        throw new Error('No text content extracted from Word document');
      }

      log('Word document processing successful:', {
        contentLength: result.value.length
      });

      return result.value;
    } catch (error) {
      log('Word document processing error:', error);
      throw new Error(`Failed to process Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getProcessingMethod(mimeType: string): string {
    switch (mimeType) {
      case "application/pdf":
        return "pdf-service";
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