import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import debug from 'debug';

const log = debug('jurysync:document-processor');

// Initialize LangChain chat model with higher token limits
const chatModel = new ChatOpenAI({
  modelName: "gpt-4-0125-preview",
  maxTokens: 4096,
  temperature: 0.3
});

interface ProcessingResult {
  success: boolean;
  content?: string;
  metadata?: {
    pageCount?: number;
    fileType?: string;
    processingTime?: number;
    method?: string;
    analysis?: DocumentAnalysis;
  };
  error?: string;
}

interface DocumentAnalysis {
  documentType: string;
  summary: string;
  keyPoints: string[];
  entities: string[];
  confidence: number;
}

// Create analysis chain
const analysisPrompt = PromptTemplate.fromTemplate(`
Analyze the following document content and provide structured insights.
Focus on identifying key information, document type, and important entities.

Document Content: {content}

Provide a detailed analysis including:
1. Document type and purpose
2. Key points and findings
3. Important entities mentioned
4. Level of confidence in the analysis (0-1)

Format the response as a structured analysis.
`);

const analysisChain = RunnableSequence.from([
  analysisPrompt,
  chatModel,
  new StringOutputParser(),
]);

export async function processDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ProcessingResult> {
  log('Processing document: %s (%s)', filename, mimeType);
  const startTime = Date.now();

  try {
    // Extract content
    const result = await extractContent(buffer, mimeType);

    if (!result.content) {
      throw new Error(`Content extraction failed for ${filename}`);
    }

    // Analyze content using LangChain
    const analysis = await analyzeDocument(result.content);

    return {
      success: true,
      content: result.content,
      metadata: {
        ...result.metadata,
        processingTime: Date.now() - startTime,
        fileType: mimeType,
        analysis
      }
    };
  } catch (error: any) {
    log('ERROR in document processing: %o', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Document processing failed'
    };
  }
}

async function analyzeDocument(content: string): Promise<DocumentAnalysis> {
  try {
    const analysisResult = await analysisChain.invoke({
      content: content.substring(0, 8000) // Ensure we don't exceed token limits
    });

    // Parse the analysis result
    const analysis = JSON.parse(analysisResult);

    return {
      documentType: analysis.documentType || 'UNKNOWN',
      summary: analysis.summary || '',
      keyPoints: analysis.keyPoints || [],
      entities: analysis.entities || [],
      confidence: analysis.confidence || 0
    };
  } catch (error) {
    log('Document analysis error:', error);
    throw error;
  }
}

async function extractContent(
  buffer: Buffer,
  mimeType: string
): Promise<{ content: string; metadata?: any }> {
  log('Extracting content for mimetype: %s', mimeType);

  try {
    switch (mimeType) {
      case 'application/pdf':
        return await extractPDFContent(buffer);
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await extractDocxContent(buffer);
      case 'text/plain':
        return { 
          content: buffer.toString('utf-8'),
          metadata: {
            method: 'text'
          }
        };
      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    log('Extraction error: %o', error);
    throw error;
  }
}

async function extractPDFContent(buffer: Buffer): Promise<{ content: string; metadata: any }> {
  log('Starting PDF content extraction');

  try {
    // Use pdf-parse for text extraction
    const data = await pdfParse(buffer);

    log('Successfully extracted text from PDF');

    return {
      content: data.text.trim() || 'PDF content extraction limited. Please try OCR for better results.',
      metadata: {
        pageCount: data.numpages,
        method: 'pdf-parse',
        info: data.info
      }
    };
  } catch (error) {
    log('PDF extraction failed: %o', error);
    throw new Error('Failed to extract PDF content');
  }
}

async function extractDocxContent(buffer: Buffer): Promise<{ content: string; metadata: any }> {
  log('Starting DOCX content extraction');

  try {
    const result = await mammoth.extractRawText({ buffer });

    if (!result.value) {
      throw new Error('Failed to extract content from DOCX file');
    }

    log('Successfully extracted DOCX content');

    return {
      content: result.value.trim(),
      metadata: {
        method: 'mammoth'
      }
    };
  } catch (error) {
    log('DOCX extraction failed: %o', error);
    throw error;
  }
}