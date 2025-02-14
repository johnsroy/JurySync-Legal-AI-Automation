import Anthropic from '@anthropic-ai/sdk';
import { openai } from "../openai";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface DocumentClassification {
  documentType: string;
  category: string;
  confidence: number;
  complianceStatus: string;
  metadata: {
    industry?: string;
    jurisdiction?: string;
    regulatoryFramework?: string;
    businessContext?: string;
  };
}

export class DocumentClassificationAgent {
  private static instance: DocumentClassificationAgent;

  private mandaKeywords = [
    'merger', 'acquisition', 'stock purchase', 'asset purchase', 'm&a',
    'business combination', 'consolidation', 'takeover', 'share purchase',
    'amalgamation', 'corporate restructuring', 'merge'
  ];

  private industryKeywords = {
    TECHNOLOGY: ['tech', 'software', 'it', 'digital', 'computer', 'internet', 'saas'],
    HEALTHCARE: ['health', 'medical', 'pharma', 'biotech', 'hospital'],
    FINANCIAL: ['bank', 'finance', 'investment', 'insurance', 'fintech'],
    MANUFACTURING: ['manufacturing', 'industrial', 'production', 'factory'],
    RETAIL: ['retail', 'commerce', 'sales', 'store', 'ecommerce']
  };

  public static getInstance(): DocumentClassificationAgent {
    if (!DocumentClassificationAgent.instance) {
      DocumentClassificationAgent.instance = new DocumentClassificationAgent();
    }
    return DocumentClassificationAgent.instance;
  }

  private constructor() {}

  private async detectDocumentType(content: string): Promise<{ isMA: boolean; confidence: number }> {
    try {
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

      if (!completion.choices[0].message.content) {
        throw new Error("Empty response from GPT-4");
      }

      const result = JSON.parse(completion.choices[0].message.content);
      return {
        isMA: result.isMA,
        confidence: result.confidence
      };
    } catch (error) {
      console.error("GPT-4 analysis failed:", error);
      return { isMA: false, confidence: 0 };
    }
  }

  public async classifyDocument(content: string): Promise<DocumentClassification> {
    try {
      console.log("Starting document classification with M&A detection...");

      // First, check if it's an M&A document using GPT-4
      const { isMA, confidence } = await this.detectDocumentType(content);

      // Enhanced M&A detection with keyword matching
      const lowerContent = content.toLowerCase();
      const foundMandAKeywords = this.mandaKeywords.filter(keyword => 
        lowerContent.includes(keyword.toLowerCase())
      );

      const isStronglyMA = isMA || (foundMandAKeywords.length >= 2 && confidence > 0.6);

      if (isStronglyMA) {
        console.log("M&A document detected with high confidence");
        const industry = await this.detectIndustry(content);
        return {
          documentType: "M&A Deal",
          category: "M&A Deal",
          confidence: confidence,
          complianceStatus: "Needs Review",
          metadata: {
            industry: industry,
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
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `Analyze the document and identify the primary industry it relates to.
            Return only the industry name in uppercase (e.g., "TECHNOLOGY", "HEALTHCARE", "FINANCIAL").`
          },
          {
            role: "user",
            content: content.substring(0, 4000)
          }
        ]
      });

      const response = completion.choices[0].message.content;
      return response ? response.trim().toUpperCase() : "TECHNOLOGY";
    } catch (error) {
      console.error("Industry detection failed:", error);
      return "TECHNOLOGY";
    }
  }

  private async classifyWithGPT4(content: string): Promise<DocumentClassification> {
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

    if (!completion.choices[0].message.content) {
      throw new Error("Empty response from GPT-4");
    }

    const result = JSON.parse(completion.choices[0].message.content);

    // Double check for M&A keywords in the document type and content
    const lowerContent = content.toLowerCase();
    const lowerDocType = result.documentType.toLowerCase();

    const hasMandAKeywords = this.mandaKeywords.some(keyword => 
      lowerContent.includes(keyword.toLowerCase()) || 
      lowerDocType.includes(keyword.toLowerCase())
    );

    if (hasMandAKeywords) {
      result.documentType = "M&A Deal";
      result.category = "M&A Deal";
    }

    return result;
  }
}

export const documentClassificationAgent = DocumentClassificationAgent.getInstance();