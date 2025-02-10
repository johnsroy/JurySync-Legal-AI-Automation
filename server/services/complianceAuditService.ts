import { OpenAI } from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { db } from '../db';
import { complianceAudits, documents } from '@shared/schema';
import { chromaStore } from './chromaStore';
import { Buffer } from 'buffer';

const MAX_CHUNK_SIZE = 8000;
const HTML_TAG_REGEX = /<[^>]*>|<!DOCTYPE.*?>/i;
const DOCTYPE_REGEX = /<!DOCTYPE\s+[^>]*>|<!doctype\s+[^>]*>/gi;
const INVALID_CHARACTERS_REGEX = /[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g;

// Define interfaces for the compliance audit data
interface QuickStats {
  characterCount: number;
  wordCount: number;
  lineCount: number;
  paragraphCount: number;
}

function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ComplianceAudit] [${type.toUpperCase()}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
}

// Add validation utilities
function containsHTMLTags(text: string): boolean {
  return HTML_TAG_REGEX.test(text);
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normalize Windows line endings
    .replace(/\r/g, '\n')   // Normalize Mac line endings
    .replace(/\n\n+/g, '\n\n') // Normalize multiple line breaks
    .replace(/\t/g, '    ') // Convert tabs to spaces
    .replace(INVALID_CHARACTERS_REGEX, '') // Remove control characters
    .trim();
}

function cleanHTMLContent(text: string): string {
  log('Starting HTML content cleaning', 'debug', { 
    originalLength: text.length,
    hasDOCTYPE: DOCTYPE_REGEX.test(text)
  });

  // First pass: Remove DOCTYPE declarations specifically
  let cleaned = text.replace(DOCTYPE_REGEX, '');

  // Second pass: Remove other HTML elements
  cleaned = cleaned
    .replace(/<\?xml\s+[^>]*\?>/gi, '')  // Remove XML declarations
    .replace(/<!--[\s\S]*?-->/g, '')     // Remove HTML comments
    .replace(/<[^>]+>/g, ' ')            // Remove any remaining HTML tags
    .replace(/&[a-z]+;/gi, ' ');         // Remove HTML entities

  // Third pass: Clean up whitespace
  cleaned = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();

  log('HTML content cleaning completed', 'debug', {
    finalLength: cleaned.length,
    hasDOCTYPEAfterCleaning: DOCTYPE_REGEX.test(cleaned)
  });

  return cleaned;
}

async function parseDocument(file: Express.Multer.File): Promise<string> {
  const buffer = file.buffer;
  const mimeType = file.mimetype;

  try {
    log('Starting document parsing', 'info', { mimeType });

    // Validate file content before parsing
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty file content');
    }

    let text = '';

    // Parse based on mime type
    switch (mimeType) {
      case 'application/pdf':
        try {
          const pdfjsLib = await import('pdf-parse');
          const pdfData = await pdfjsLib.default(buffer);
          text = pdfData.text;
          log('PDF parsing successful', 'debug');
        } catch (err) {
          log('PDF parsing error', 'error', { error: (err as Error).message });
          throw new Error(`PDF parsing failed: ${(err as Error).message}`);
        }
        break;

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        try {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer });
          text = result.value;
          log('Word document parsing successful', 'debug');
        } catch (err) {
          log('Word document parsing error', 'error', { error: (err as Error).message });
          throw new Error(`Word document parsing failed: ${(err as Error).message}`);
        }
        break;

      case 'text/plain':
        text = buffer.toString('utf-8');
        log('Plain text parsing successful', 'debug');
        break;

      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }

    // Validate extracted text
    if (!text || text.trim().length === 0) {
      throw new Error('No text content found in document');
    }

    log('Raw text extracted', 'debug', {
      length: text.length,
      containsHTML: containsHTMLTags(text),
      hasDOCTYPE: DOCTYPE_REGEX.test(text),
      sample: text.substring(0, 100)
    });

    // Clean HTML content first
    text = cleanHTMLContent(text);

    // Final normalization
    text = normalizeText(text);

    // Validate final text
    if (DOCTYPE_REGEX.test(text)) {
      log('Warning: DOCTYPE tags still present after cleaning', 'error', {
        sample: text.substring(0, 200)
      });
      // One final attempt to remove any remaining DOCTYPE tags
      text = text.replace(DOCTYPE_REGEX, '').trim();
    }

    log('Document processing completed', 'info', {
      originalLength: buffer.length,
      finalLength: text.length,
      containsHTMLAfterCleaning: containsHTMLTags(text),
      hasDOCTYPEAfterCleaning: DOCTYPE_REGEX.test(text)
    });

    return text;

  } catch (error: any) {
    log('Document parsing failed', 'error', {
      error: error.message,
      stack: error.stack,
      mimeType
    });
    throw error;
  }
}

function chunkDocument(text: string): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  // Split by paragraphs but preserve meaningful breaks
  const paragraphs = text
    .split(/(?:\r?\n){2,}/)
    .filter(p => p.trim().length > 0);

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += paragraph + '\n\n';
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("Missing ANTHROPIC_API_KEY environment variable");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });


const taskStorage = new Map<string, {
  status: 'processing' | 'completed' | 'error';
  data?: any;
  error?: string;
  progress?: number;
  completedAt?: string;
}>();

async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      log(`Operation failed, attempt ${i + 1} of ${maxRetries}`, 'error', { error: error.message });
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

export class ComplianceAuditService {
  private static instance: ComplianceAuditService;

  private constructor() {
    log('Initializing ComplianceAuditService', 'info');
  }

  static getInstance(): ComplianceAuditService {
    if (!ComplianceAuditService.instance) {
      ComplianceAuditService.instance = new ComplianceAuditService();
    }
    return ComplianceAuditService.instance;
  }

  private async analyzeWithOpenAI(documentText: string) {
    return retryOperation(async () => {
      try {
        log('Starting OpenAI analysis', 'info');

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('OpenAI analysis timeout')), 30000);
        });

        const analysisPromise = openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a legal compliance expert. Analyze the provided document and return a detailed JSON response with comprehensive compliance analysis, risk assessment, and visualization-ready metrics."
            },
            {
              role: "user",
              content: `Analyze this legal document thoroughly and provide a detailed JSON report. Consider regulatory compliance, risk assessment, and visualization data.

              Document Text: ${documentText}

              Please format your response as JSON with this exact structure:
              {
                "auditReport": {
                  "summary": "comprehensive analysis overview",
                  "flaggedIssues": [
                    {
                      "issue": "detailed description of the issue",
                      "riskScore": number between 1 and 10,
                      "severity": "low|medium|high",
                      "section": "document section reference",
                      "recommendation": "specific action to resolve",
                      "regulatoryReference": "applicable regulation or standard",
                      "impact": "potential consequences"
                    }
                  ],
                  "riskScores": {
                    "average": number between 1 and 10,
                    "max": number between 1 and 10,
                    "min": number between 1 and 10,
                    "distribution": {
                      "high": number,
                      "medium": number,
                      "low": number
                    }
                  },
                  "recommendedActions": [
                    {
                      "action": "specific recommendation",
                      "priority": "high|medium|low",
                      "timeline": "immediate|short-term|long-term",
                      "impact": "expected outcome"
                    }
                  ],
                  "visualizationData": {
                    "issueFrequency": [number array representing issue count by category],
                    "riskTrend": [number array representing risk scores across document sections],
                    "complianceScores": {
                      "overall": number between 0 and 100,
                      "regulatory": number between 0 and 100,
                      "clarity": number between 0 and 100,
                      "risk": number between 0 and 100
                    }
                  }
                }
              }`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2
        });

        const response = await Promise.race([analysisPromise, timeoutPromise]);

        log('OpenAI raw response received', 'debug', {
          status: response?.choices?.[0]?.finish_reason,
          contentLength: response?.choices?.[0]?.message?.content?.length
        });

        if (!response?.choices?.[0]?.message?.content) {
          throw new Error('Invalid response format from OpenAI');
        }

        const result = JSON.parse(response.choices[0].message.content);

        log('OpenAI analysis completed successfully', 'info', {
          responseStructure: Object.keys(result),
          summary: result.auditReport?.summary?.substring(0, 100),
          issuesCount: result.auditReport?.flaggedIssues?.length
        });

        return result;
      } catch (error: any) {
        log('OpenAI analysis failed', 'error', {
          error: error.message,
          stack: error.stack,
          response: error.response?.data,
          type: error.constructor.name
        });
        throw error;
      }
    });
  }

  private async analyzeWithAnthropic(documentText: string) {
    return retryOperation(async () => {
      try {
        log('Starting Anthropic analysis', 'info');

        const response = await anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1500,
          messages: [{
            role: "user",
            content: `Analyze this legal document thoroughly for compliance issues and provide a detailed JSON report.

            Document Text: ${documentText}

            Format your response as JSON with this exact structure:
            {
              "auditReport": {
                "summary": "comprehensive analysis overview",
                "flaggedIssues": [
                  {
                    "issue": "detailed description of the issue",
                    "riskScore": number between 1 and 10,
                    "severity": "low|medium|high",
                    "section": "document section reference",
                    "recommendation": "specific action to resolve",
                    "regulatoryReference": "applicable regulation or standard",
                    "impact": "potential consequences"
                  }
                ],
                "riskScores": {
                  "average": number between 1 and 10,
                  "max": number between 1 and 10,
                  "min": number between 1 and 10,
                  "distribution": {
                    "high": number,
                    "medium": number,
                    "low": number
                  }
                },
                "recommendedActions": [
                  {
                    "action": "specific recommendation",
                    "priority": "high|medium|low",
                    "timeline": "immediate|short-term|long-term",
                    "impact": "expected outcome"
                  }
                ],
                "visualizationData": {
                  "issueFrequency": [number array representing issue count by category],
                  "riskTrend": [number array representing risk scores across document sections],
                  "complianceScores": {
                    "overall": number between 0 and 100,
                    "regulatory": number between 0 and 100,
                    "clarity": number between 0 and 100,
                    "risk": number between 0 and 100
                  }
                }
              }
            }`
          }]
        });

        log('Anthropic raw response received', 'debug', {
          contentType: response.content[0]?.type,
          contentLength: response.content[0]?.text?.length
        });

        const content = response.content[0];
        if (content.type !== 'text') {
          throw new Error('Unexpected response format from Anthropic API');
        }

        const result = JSON.parse(content.text);

        log('Anthropic analysis completed successfully', 'info', {
          responseStructure: Object.keys(result),
          summary: result.auditReport?.summary?.substring(0, 100),
          issuesCount: result.auditReport?.flaggedIssues?.length
        });

        return result;
      } catch (error: any) {
        log('Anthropic analysis failed', 'error', {
          error: error.message,
          stack: error.stack,
          response: error.response?.data,
          type: error.constructor.name
        });
        throw error;
      }
    });
  }

  private async analyzeDocument(documentText: string, taskId: string) {
    try {
      log('Starting combined compliance analysis', 'info', { taskId });

      taskStorage.set(taskId, { status: 'processing', progress: 0 });

      const chunks = chunkDocument(documentText);
      log('Document split into chunks', 'info', {
        numberOfChunks: chunks.length,
        averageChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length),
        taskId
      });

      const chunkResults = await Promise.all(chunks.map(async (chunk, index) => {
        log(`Processing chunk ${index + 1}/${chunks.length}`, 'info', { taskId });

        taskStorage.set(taskId, {
          status: 'processing',
          progress: Math.round((index / chunks.length) * 50)
        });

        const [openAIAnalysis, anthropicAnalysis] = await Promise.allSettled([
          this.analyzeWithOpenAI(chunk),
          this.analyzeWithAnthropic(chunk)
        ]);

        return {
          openAI: openAIAnalysis.status === 'fulfilled' ? openAIAnalysis.value : null,
          anthropic: anthropicAnalysis.status === 'fulfilled' ? anthropicAnalysis.value : null,
          chunkIndex: index
        };
      }));

      const combinedReport = this.combineChunkResults(chunkResults);

      taskStorage.set(taskId, {
        status: 'processing',
        progress: 75
      });

      try {
        const [document] = await db.insert(documents).values({
          title: `Compliance Audit - ${new Date().toISOString()}`,
          content: documentText,
          analysis: { openAIAnalysis: combinedReport, anthropicAnalysis: combinedReport },
          agentType: 'COMPLIANCE_AUDITING',
          userId: 1,
        }).returning();

        log('Document created in database', 'info', { documentId: document.id, taskId });

        const [auditRecord] = await db.insert(complianceAudits).values({
          documentText: documentText,
          openaiResponse: combinedReport,
          anthropicResponse: combinedReport,
          combinedReport: combinedReport,
          vectorId: document.id.toString(),
          metadata: {
            documentType: 'compliance_audit',
            confidence: combinedReport.auditReport.visualizationData.complianceScores.overall / 100,
            tags: combinedReport.auditReport.flaggedIssues.map(issue => issue.regulatoryReference).filter(Boolean)
          }
        }).returning();

        taskStorage.set(taskId, {
          status: 'completed',
          data: combinedReport,
          completedAt: new Date().toISOString()
        });

        log('Combined analysis completed', 'info', {
          auditId: auditRecord.id,
          documentId: document.id,
          issuesCount: combinedReport.auditReport.flaggedIssues.length,
          completionTime: new Date().toISOString(),
          taskId
        });

        return combinedReport;

      } catch (dbError: any) {
        log('Database operation failed', 'error', {
          error: dbError.message,
          stack: dbError.stack,
          taskId
        });

        taskStorage.set(taskId, {
          status: 'error',
          error: dbError.message,
          completedAt: new Date().toISOString()
        });

        throw dbError;
      }

    } catch (error: any) {
      log('Combined analysis failed', 'error', {
        error: error.message,
        stack: error.stack,
        taskId
      });

      taskStorage.set(taskId, {
        status: 'error',
        error: error.message,
        completedAt: new Date().toISOString()
      });

      throw error;
    }
  }

  private combineChunkResults(chunkResults: Array<{
    openAI: any | null;
    anthropic: any | null;
    chunkIndex: number;
  }>): any {
    const combined = {
      auditReport: {
        summary: '',
        flaggedIssues: [],
        riskScores: {
          average: 0,
          max: 0,
          min: 10,
          distribution: {
            high: 0,
            medium: 0,
            low: 0
          }
        },
        recommendedActions: [],
        visualizationData: {
          issueFrequency: [],
          riskTrend: [],
          complianceScores: {
            overall: 0,
            regulatory: 0,
            clarity: 0,
            risk: 0
          }
        }
      }
    };

    let validChunks = 0;
    const summaries: string[] = [];

    chunkResults.forEach(({ openAI, anthropic, chunkIndex }) => {
      const result = openAI || anthropic;
      if (!result?.auditReport) return;

      validChunks++;
      const { auditReport } = result;

      if (auditReport.summary) {
        summaries.push(auditReport.summary);
      }

      combined.auditReport.flaggedIssues.push(...auditReport.flaggedIssues);

      combined.auditReport.riskScores.max = Math.max(
        combined.auditReport.riskScores.max,
        auditReport.riskScores.max
      );
      combined.auditReport.riskScores.min = Math.min(
        combined.auditReport.riskScores.min,
        auditReport.riskScores.min
      );

      combined.auditReport.riskScores.distribution.high += auditReport.riskScores.distribution.high;
      combined.auditReport.riskScores.distribution.medium += auditReport.riskScores.distribution.medium;
      combined.auditReport.riskScores.distribution.low += auditReport.riskScores.distribution.low;

      combined.auditReport.recommendedActions.push(...auditReport.recommendedActions);

      combined.auditReport.visualizationData.riskTrend.push(...auditReport.visualizationData.riskTrend);

      combined.auditReport.visualizationData.complianceScores.overall += auditReport.visualizationData.complianceScores.overall;
      combined.auditReport.visualizationData.complianceScores.regulatory += auditReport.visualizationData.complianceScores.regulatory;
      combined.auditReport.visualizationData.complianceScores.clarity += auditReport.visualizationData.complianceScores.clarity;
      combined.auditReport.visualizationData.complianceScores.risk += auditReport.visualizationData.complianceScores.risk;
    });

    if (validChunks === 0) {
      throw new Error('No valid analysis results from any chunk');
    }

    combined.auditReport.riskScores.average = combined.auditReport.riskScores.max + combined.auditReport.riskScores.min / 2;
    combined.auditReport.visualizationData.complianceScores.overall /= validChunks;
    combined.auditReport.visualizationData.complianceScores.regulatory /= validChunks;
    combined.auditReport.visualizationData.complianceScores.clarity /= validChunks;
    combined.auditReport.visualizationData.complianceScores.risk /= validChunks;

    combined.auditReport.summary = summaries.join(' ');

    return combined;
  }

  async getTaskResult(taskId: string) {
    const task = taskStorage.get(taskId);
    if (!task) {
      return null;
    }
    return task;
  }
}

export const complianceAuditService = ComplianceAuditService.getInstance();