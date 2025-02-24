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
  modelName: "gpt-4o", // Latest model as of May 13, 2024
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

export async function processDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ProcessingResult> {
  log('Starting document processing:', { filename, mimeType, bufferSize: buffer.length });
  const startTime = Date.now();

  try {
    // Extract content based on file type
    let extractionResult;
    try {
      extractionResult = await extractContent(buffer, mimeType);
      log('Content extraction successful:', { 
        contentLength: extractionResult.content.length,
        method: extractionResult.metadata?.method 
      });
    } catch (extractError) {
      log('Content extraction failed:', extractError);
      throw new Error(`Failed to extract content: ${extractError.message}`);
    }

    if (!extractionResult.content) {
      throw new Error('No content could be extracted from document');
    }

    // Analyze content
    let analysis;
    try {
      analysis = await analyzeDocument(extractionResult.content);
      log('Document analysis completed successfully');
    } catch (analysisError) {
      log('Document analysis failed:', analysisError);
      // Continue even if analysis fails
      analysis = {
        documentType: 'UNKNOWN',
        summary: 'Analysis failed',
        keyPoints: [],
        entities: [],
        confidence: 0
      };
    }

    return {
      success: true,
      content: extractionResult.content,
      metadata: {
        ...extractionResult.metadata,
        processingTime: Date.now() - startTime,
        fileType: mimeType,
        analysis
      }
    };
  } catch (error: any) {
    log('Document processing failed:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      filename,
      mimeType
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Document processing failed',
      metadata: {
        processingTime: Date.now() - startTime,
        fileType: mimeType
      }
    };
  }
}

async function extractContent(
  buffer: Buffer,
  mimeType: string
): Promise<{ content: string; metadata?: any }> {
  log('Extracting content for mimetype:', mimeType);

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
    log('Content extraction error:', error);
    throw error;
  }
}

async function extractPDFContent(buffer: Buffer): Promise<{ content: string; metadata: any }> {
  log('Starting PDF content extraction');

  try {
    const data = await pdfParse(buffer);

    if (!data.text || data.text.trim().length === 0) {
      throw new Error('PDF appears to be empty or contains no extractable text');
    }

    log('Successfully extracted text from PDF:', {
      pages: data.numpages,
      textLength: data.text.length
    });

    return {
      content: data.text.trim(),
      metadata: {
        pageCount: data.numpages,
        method: 'pdf-parse',
        info: data.info
      }
    };
  } catch (error) {
    log('PDF extraction failed:', error);
    throw new Error(`Failed to extract PDF content: ${error.message}`);
  }
}

async function extractDocxContent(buffer: Buffer): Promise<{ content: string; metadata: any }> {
  log('Starting DOCX content extraction');

  try {
    const result = await mammoth.extractRawText({ buffer });

    if (!result.value) {
      throw new Error('Failed to extract content from DOCX file');
    }

    log('Successfully extracted DOCX content:', {
      textLength: result.value.length
    });

    return {
      content: result.value.trim(),
      metadata: {
        method: 'mammoth'
      }
    };
  } catch (error) {
    log('DOCX extraction failed:', error);
    throw error;
  }
}

async function analyzeDocument(content: string): Promise<DocumentAnalysis> {
  try {
    log('Starting document analysis with content length:', content.length);

    const analysisResult = await analysisChain.invoke({
      content: content.substring(0, 8000) // Ensure we don't exceed token limits
    });

    log('Received analysis result');

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
    throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

const analysisPrompt = PromptTemplate.fromTemplate(`
Analyze the following document content and provide structured insights.
Focus on identifying key information, document type, and important entities.

Document Content: {content}

Provide a detailed analysis including:
1. Document type and purpose
2. Key points and findings
3. Important entities mentioned
4. Level of confidence in the analysis (0-1)

Format the response as JSON with the following structure:
{
  "documentType": string,
  "summary": string,
  "keyPoints": string[],
  "entities": string[],
  "confidence": number
}
`);

const analysisChain = RunnableSequence.from([
  analysisPrompt,
  chatModel,
  new StringOutputParser(),
]);