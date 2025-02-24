import mammoth from "mammoth";
import { Readable } from "stream";
import debug from "debug";

const log = debug("app:document-processor");

export class DocumentProcessor {
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
