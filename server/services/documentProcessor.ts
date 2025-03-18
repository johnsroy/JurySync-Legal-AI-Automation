import { OpenAI } from "openai";
import debug from "debug";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { v4 as uuidv4 } from "uuid";
import mammoth from "mammoth";
import { pdfProcessor } from "./pdfProcessor";

const log = debug("app:document-processor");

export interface ProcessingResult {
  success: boolean;
  content?: string;
  metadata?: any;
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
  ): Promise<ProcessingResult> {
    try {
      log(`Processing document: ${filename} (${mimetype})`);

      let content = "";
      let metadata = {};

      // Process based on file type
      if (mimetype === "application/pdf") {
        log("Processing PDF document with new PDF processor");
        try {
          // Use our new PDF processor
          const result = await pdfProcessor.processBuffer(buffer);
          
          if (!result.success) {
            throw new Error(result.error || "PDF processing failed");
          }
          
          content = result.text || "";
          metadata = { 
            pageCount: result.pageCount || 1,
            source: "pdf-basic-extraction" 
          };
          
          log(`PDF processed successfully: ${content.length} characters`);
        } catch (pdfError) {
          log("PDF extraction failed, using placeholder:", pdfError);
          content = "[PDF content placeholder - extraction failed but document was received]";
          metadata = { source: "pdf-fallback-extraction" };
        }
      } 
      else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
               mimetype === "application/msword") {
        log("Processing Word document");
        try {
          const result = await mammoth.extractRawText({ buffer });
          content = result.value;
          metadata = { source: "docx-extraction" };
          log(`Word document processed successfully: ${content.length} characters`);
        } catch (docxError) {
          log("DOCX extraction failed:", docxError);
          throw new Error(`Failed to extract text from Word document: ${docxError instanceof Error ? docxError.message : 'Unknown error'}`);
        }
      }
      else if (mimetype === "text/plain") {
        log("Processing text document");
        content = buffer.toString('utf8');
        metadata = { source: "text-extraction" };
        log(`Text document processed successfully: ${content.length} characters`);
      }
      else {
        throw new Error(`Unsupported file type: ${mimetype}`);
      }

      // Validate content
      if (!content || content.trim().length === 0) {
        log("No content extracted from document");
        // Create a placeholder content if extraction failed
        content = `[Document content could not be extracted from ${filename}]`;
        metadata = { ...metadata, extractionFailed: true };
      }

      log(`Successfully processed document: ${filename}`);
      return { 
        success: true, 
        content, 
        metadata 
      };
    } catch (error) {
      log("Document processing error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during document processing"
      };
    }
  }
}

export const documentProcessor = new DocumentProcessor();