import { OpenAI } from "openai";
import debug from "debug";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { v4 as uuidv4 } from "uuid";

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

class DocumentProcessor {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async processDocument(
    buffer: Buffer,
    filename: string,
    mimetype: string
  ): Promise<{ success: boolean; content?: string; metadata?: any; error?: string }> {
    try {
      log(`Processing document: ${filename} (${mimetype})`);

      // Create temp file
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, `${uuidv4()}-${filename}`);

      try {
        // Write buffer to temp file
        fs.writeFileSync(tempFilePath, buffer);
        log(`Temporary file created at: ${tempFilePath}`);

        // Extract text based on file type
        let content = "";
        let metadata = {};

        if (mimetype === "application/pdf") {
          log("Processing PDF document");
          const result = await this.extractPDFText(buffer);
          content = result.text;
          metadata = { 
            pageCount: result.pageCount,
            source: "pdf-extraction" 
          };
        } 
        else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
                 mimetype === "application/msword") {
          log("Processing Word document");
          content = await this.extractWordText(buffer);
          metadata = { source: "docx-extraction" };
        }
        else if (mimetype === "text/plain") {
          log("Processing text document");
          content = buffer.toString('utf8');
          metadata = { source: "text-extraction" };
        }
        else {
          throw new Error(`Unsupported file type: ${mimetype}`);
        }

        // Clean up temp file
        fs.unlinkSync(tempFilePath);

        if (!content || content.trim().length === 0) {
          throw new Error("Failed to extract content from document");
        }

        log(`Successfully extracted ${content.length} characters from document`);
        return { 
          success: true, 
          content, 
          metadata 
        };
      } catch (error) {
        // Clean up temp file if it exists
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        throw error;
      }
    } catch (error) {
      log("Document processing error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during document processing"
      };
    }
  }

  private async extractPDFText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
    // Use pdf-parse or another PDF library that's already installed
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return {
      text: data.text,
      pageCount: data.numpages
    };
  }

  private async extractWordText(buffer: Buffer): Promise<string> {
    // Use mammoth for DOCX files
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
}

export const documentProcessor = new DocumentProcessor();