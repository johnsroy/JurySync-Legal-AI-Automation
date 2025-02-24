import mammoth from "mammoth";
import { Readable } from "stream";
import debug from "debug";

const log = debug("app:document-processor");

export class DocumentProcessor {
  static async processDocument(buffer: Buffer, filename: string): Promise<{ success: boolean; content: string; metadata?: any }> {
    try {
      // Determine file type from filename
      const isWord = filename.toLowerCase().endsWith('.docx') || filename.toLowerCase().endsWith('.doc');
      const isText = filename.toLowerCase().endsWith('.txt');

      let content = '';
      if (isWord) {
        const result = await mammoth.extractRawText({ buffer });
        content = result.value;
      } else if (isText) {
        content = buffer.toString('utf-8');
      } else {
        throw new Error(`Unsupported file type: ${filename}`);
      }

      return {
        success: true,
        content,
        metadata: {
          processingTime: new Date().toISOString(),
          fileType: isWord ? 'word' : 'text',
          filename
        }
      };
    } catch (error) {
      log("Document processing error:", error);
      throw new Error("Failed to process document");
    }
  }

  async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      switch (mimeType) {
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

  private async processWord(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      log("Word document processing error:", error);
      throw new Error("Failed to process Word document");
    }
  }
}