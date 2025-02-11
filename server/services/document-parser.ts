import { readFile } from "fs/promises";
import pdf from "pdf-parse";
import mammoth from "mammoth";

export interface ParsedDocument {
  text: string;
  metadata: {
    filename: string;
    fileType: string;
    pageCount?: number;
    wordCount: number;
  };
}

export class DocumentParsingError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "DocumentParsingError";
  }
}

export async function parseDocument(
  filePath: string,
  originalFilename: string
): Promise<ParsedDocument> {
  const fileType = originalFilename.split(".").pop()?.toLowerCase();
  let text: string;
  let pageCount: number | undefined;

  try {
    switch (fileType) {
      case "pdf":
        const pdfBuffer = await readFile(filePath);
        const pdfData = await pdf(pdfBuffer);
        text = pdfData.text;
        pageCount = pdfData.numpages;
        break;

      case "docx":
        const docxBuffer = await readFile(filePath);
        const docxResult = await mammoth.extractRawText({ buffer: docxBuffer });
        text = docxResult.value;
        break;

      case "txt":
        const txtBuffer = await readFile(filePath);
        text = txtBuffer.toString("utf-8");
        break;

      default:
        throw new DocumentParsingError(
          "Unsupported file format",
          "UNSUPPORTED_FORMAT"
        );
    }

    // Clean and validate the extracted text
    text = cleanText(text);
    validateText(text);

    return {
      text,
      metadata: {
        filename: originalFilename,
        fileType: fileType || "unknown",
        pageCount,
        wordCount: text.split(/\s+/).length,
      },
    };
  } catch (error: unknown) {
    if (error instanceof DocumentParsingError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new DocumentParsingError(
      `Failed to parse document: ${errorMessage}`,
      "PARSING_ERROR"
    );
  }
}

function cleanText(text: string): string {
  return text
    .replace(/<!DOCTYPE[^>]*>/g, "") // Remove DOCTYPE declarations
    .replace(/<[^>]+>/g, "") // Remove HTML tags
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

function validateText(text: string): void {
  if (!text || text.length < 10) {
    throw new DocumentParsingError(
      "Document contains insufficient text content",
      "INVALID_CONTENT"
    );
  }

  if (text.includes("<!DOCTYPE") || /<\/?[a-z][\s\S]*>/i.test(text)) {
    throw new DocumentParsingError(
      "Document contains invalid HTML content",
      "HTML_CONTENT"
    );
  }
}