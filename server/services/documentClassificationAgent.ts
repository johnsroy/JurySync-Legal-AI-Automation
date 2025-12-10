import Anthropic from '@anthropic-ai/sdk';
import { openai } from "../openai";

// Initialize Anthropic client (only if API key is available)
let anthropic: Anthropic | null = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

export interface DocumentClassification {
  documentType: string;
  category: string;
  confidence: number;
  complianceStatus: 'Compliant' | 'Non-Compliant' | 'Needs Review';
  metadata: {
    industry?: string;
    jurisdiction?: string;
    regulatoryFramework?: string;
    businessContext?: string;
  };
}

interface MADetectionResult {
  isMA: boolean;
  confidence: number;
  keywords?: string[];
}

export class DocumentClassificationAgent {
  private static instance: DocumentClassificationAgent;

  private mandaKeywords = [
    'merger', 'acquisition', 'stock purchase', 'asset purchase', 'm&a',
    'business combination', 'consolidation', 'takeover', 'share purchase',
    'amalgamation', 'corporate restructuring'
  ];

  public static getInstance(): DocumentClassificationAgent {
    if (!DocumentClassificationAgent.instance) {
      DocumentClassificationAgent.instance = new DocumentClassificationAgent();
    }
    return DocumentClassificationAgent.instance;
  }

  private constructor() {}

  private async detectDocumentType(content: string): Promise<MADetectionResult> {
    try {
      // Validate content
      if (!content || content.trim().length === 0) {
        return { isMA: false, confidence: 0 };
      }

      // First, do a quick keyword check
      const contentLower = content.toLowerCase();
      const keywordsFound = this.mandaKeywords.filter(kw => contentLower.includes(kw.toLowerCase()));

      // If strong keyword match, we can be fairly confident
      if (keywordsFound.length >= 3) {
        return { isMA: true, confidence: 0.8, keywords: keywordsFound };
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert in identifying M&A (Mergers & Acquisitions) documents.
            Analyze the given text and determine if it's an M&A document.
            Return a JSON object with:
            {
              "isMA": boolean (true if it's an M&A document),
              "confidence": number (between 0 and 1),
              "keywords": array of strings (key M&A terms found)
            }`
          },
          {
            role: "user",
            content: content.substring(0, 4000)
          }
        ],
        response_format: { type: "json_object" }
      });

      const messageContent = completion.choices[0]?.message?.content;
      if (!messageContent) {
        console.error("Empty response from OpenAI");
        return { isMA: false, confidence: 0 };
      }

      const result = JSON.parse(messageContent);
      return {
        isMA: Boolean(result.isMA),
        confidence: typeof result.confidence === 'number' ? result.confidence : 0,
        keywords: Array.isArray(result.keywords) ? result.keywords : []
      };
    } catch (error) {
      console.error("GPT-4 analysis failed:", error);
      // Fallback to keyword-based detection
      const contentLower = content.toLowerCase();
      const keywordsFound = this.mandaKeywords.filter(kw => contentLower.includes(kw.toLowerCase()));
      return {
        isMA: keywordsFound.length >= 2,
        confidence: keywordsFound.length >= 2 ? 0.5 : 0,
        keywords: keywordsFound
      };
    }
  }

  public async classifyDocument(content: string): Promise<DocumentClassification> {
    try {
      console.log("Starting document classification with M&A detection...");

      // First, check if it's an M&A document using GPT-4
      const { isMA, confidence } = await this.detectDocumentType(content);

      if (isMA && confidence > 0.7) {
        console.log("M&A document detected with high confidence");
        return {
          documentType: "M&A Deal",
          category: "M&A Deal",
          confidence: confidence,
          complianceStatus: "Needs Review",
          metadata: {
            industry: await this.detectIndustry(content),
            businessContext: "Mergers & Acquisitions"
          }
        };
      }

      // If not clearly M&A, proceed with detailed classification
      console.log("Proceeding with detailed document classification");
      return this.classifyWithGPT4(content);

    } catch (error) {
      console.error("Document classification error:", error);
      throw new Error("Failed to classify document");
    }
  }

  private async detectIndustry(content: string): Promise<string> {
    try {
      if (!content || content.trim().length === 0) {
        return "GENERAL";
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `Analyze the document and identify the primary industry it relates to.
            Return only the industry name in uppercase (e.g., "TECHNOLOGY", "HEALTHCARE", "FINANCIAL", "REAL_ESTATE", "MANUFACTURING", "RETAIL", "ENERGY", "GENERAL").`
          },
          {
            role: "user",
            content: content.substring(0, 4000)
          }
        ]
      });

      const messageContent = completion.choices[0]?.message?.content;
      if (!messageContent) {
        return "GENERAL";
      }

      return messageContent.trim().toUpperCase() || "GENERAL";
    } catch (error) {
      console.error("Industry detection failed:", error);
      return "GENERAL";
    }
  }

  private async classifyWithGPT4(content: string): Promise<DocumentClassification> {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert document classifier specializing in legal and business documents.
            If you detect any M&A-related content, always classify it as "M&A Deal".
            For other documents, determine the most appropriate type.
            Return a JSON object with:
            {
              "documentType": string,
              "category": string,
              "confidence": number (0-1),
              "complianceStatus": "Compliant" | "Non-Compliant" | "Needs Review",
              "metadata": {
                "industry": string,
                "businessContext": string
              }
            }`
          },
          {
            role: "user",
            content: content.substring(0, 4000)
          }
        ],
        response_format: { type: "json_object" }
      });

      const messageContent = completion.choices[0]?.message?.content;
      if (!messageContent) {
        throw new Error("Empty response from OpenAI");
      }

      const result = JSON.parse(messageContent);

      // Validate and normalize the result
      const validatedResult: DocumentClassification = {
        documentType: result.documentType || "Unknown",
        category: result.category || result.documentType || "Unknown",
        confidence: typeof result.confidence === 'number' ? Math.min(Math.max(result.confidence, 0), 1) : 0.5,
        complianceStatus: this.validateComplianceStatus(result.complianceStatus),
        metadata: {
          industry: result.metadata?.industry || "GENERAL",
          businessContext: result.metadata?.businessContext || ""
        }
      };

      // Double check for M&A keywords in the document type
      const lowerDocType = validatedResult.documentType.toLowerCase();
      if (this.mandaKeywords.some(keyword => lowerDocType.includes(keyword.toLowerCase()))) {
        validatedResult.documentType = "M&A Deal";
        validatedResult.category = "M&A Deal";
      }

      return validatedResult;
    } catch (error) {
      console.error("GPT-4 classification failed:", error);
      // Return a default classification on error
      return {
        documentType: "Unknown",
        category: "Unknown",
        confidence: 0,
        complianceStatus: "Needs Review",
        metadata: {
          industry: "GENERAL",
          businessContext: "Classification failed - manual review required"
        }
      };
    }
  }

  private validateComplianceStatus(status: string): 'Compliant' | 'Non-Compliant' | 'Needs Review' {
    const validStatuses = ['Compliant', 'Non-Compliant', 'Needs Review'];
    if (validStatuses.includes(status)) {
      return status as 'Compliant' | 'Non-Compliant' | 'Needs Review';
    }
    return 'Needs Review';
  }
}

export const documentClassificationAgent = DocumentClassificationAgent.getInstance();