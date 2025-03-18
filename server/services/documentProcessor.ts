import { OpenAI } from "openai";
import debug from "debug";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { v4 as uuidv4 } from "uuid";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

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
        log("Processing PDF document");
        try {
          const result = await this.extractPDFText(buffer);
          content = result.text;
          metadata = { 
            pageCount: result.pageCount,
            source: "pdf-extraction" 
          };
          log(`PDF processed successfully: ${content.length} characters`);
        } catch (pdfError) {
          log("PDF extraction failed, trying fallback method:", pdfError);
          // Fallback to simple buffer extraction if pdf-parse fails
          content = buffer.toString('utf8').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
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
        } catch (docxError: unknown) {
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

  private async extractPDFText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
    try {
      // Log the buffer size to help with debugging
      log(`Attempting to parse PDF, buffer size: ${buffer.length} bytes`);
      
      const data = await pdfParse(buffer, {
        // Add options to improve parsing success
        max: 0, // No page limit
        pagerender: function(pageData) {
          return pageData.getTextContent();
        }
      });
      
      // Check if we got valid data
      if (!data || !data.text) {
        log("PDF parse returned empty data");
        return {
          text: "[PDF content extraction incomplete]",
          pageCount: data?.numpages || 0
        };
      }
      
      log(`PDF parsed successfully: ${data.numpages} pages`);
      return {
        text: data.text,
        pageCount: data.numpages || 0
      };
    } catch (error) {
      log("PDF parsing error details:", error);
      // More graceful error handling - return empty result instead of throwing
      return {
        text: "[PDF parsing failed - content could not be extracted]",
        pageCount: 0
      };
    }
  }
}

export const documentProcessor = new DocumentProcessor();