import Anthropic from '@anthropic-ai/sdk';
import { openai } from '../openai';

// Initialize Anthropic client
// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface DocumentClassification {
  documentType: string;
  category: string;
  confidence: number;
  metadata: {
    industry?: string;
    jurisdiction?: string;
    regulatoryFramework?: string;
    businessContext?: string;
  };
}

export class DocumentClassificationAgent {
  private static instance: DocumentClassificationAgent;
  
  private documentTypePatterns = {
    merger: {
      patterns: ['merger', 'acquisition', 'stock purchase', 'asset purchase', 'm&a'],
      category: 'M&A Agreement',
      subTypes: {
        'merger agreement': 'Merger Agreement',
        'stock purchase': 'Stock Purchase Agreement',
        'asset purchase': 'Asset Purchase Agreement',
        'acquisition agreement': 'Acquisition Agreement'
      }
    },
    compliance: {
      patterns: ['soc', 'iso', 'hipaa', 'gdpr', 'compliance', 'audit'],
      category: 'Compliance Report',
      subTypes: {
        'soc 2': 'SOC 2 Report',
        'soc 3': 'SOC 3 Report',
        'iso 27001': 'ISO 27001 Certification',
        'hipaa': 'HIPAA Compliance Report'
      }
    },
    legal: {
      patterns: ['agreement', 'contract', 'terms', 'conditions'],
      category: 'Legal Agreement',
      subTypes: {
        'service agreement': 'Service Agreement',
        'nda': 'Non-Disclosure Agreement',
        'employment': 'Employment Agreement'
      }
    }
  };

  public static getInstance(): DocumentClassificationAgent {
    if (!DocumentClassificationAgent.instance) {
      DocumentClassificationAgent.instance = new DocumentClassificationAgent();
    }
    return DocumentClassificationAgent.instance;
  }

  private constructor() {}

  public async classifyDocument(content: string): Promise<DocumentClassification> {
    try {
      // First attempt with OpenAI
      const openAIResult = await this.classifyWithOpenAI(content);
      if (openAIResult.confidence > 0.8) {
        return openAIResult;
      }

      // Fallback to Anthropic for more detailed analysis
      return await this.classifyWithAnthropic(content);
    } catch (error) {
      console.error("Document classification error:", error);
      throw new Error("Failed to classify document");
    }
  }

  private async classifyWithOpenAI(content: string): Promise<DocumentClassification> {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an expert document classifier. Analyze the document content and classify it according to these rules:
          1. For M&A documents, use specific types like "M&A Agreement - Merger", "M&A Agreement - Stock Purchase"
          2. For compliance documents, specify the standard (e.g., "SOC 2 Report", "SOC 3 Report")
          3. For legal agreements, be specific about agreement type
          
          Return a JSON object with:
          {
            "documentType": "specific document type",
            "category": "broader category",
            "confidence": number between 0 and 1,
            "metadata": {
              "industry": "relevant industry",
              "jurisdiction": "applicable jurisdiction",
              "regulatoryFramework": "relevant framework if applicable",
              "businessContext": "business context"
            }
          }`
        },
        {
          role: "user",
          content: `Classify this document:\n\n${content.substring(0, 4000)}`
        }
      ]
    });

    return JSON.parse(completion.choices[0].message.content);
  }

  private async classifyWithAnthropic(content: string): Promise<DocumentClassification> {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: `You are an expert document classifier. When analyzing documents, be very specific about document types.
          Pay special attention to:
          1. M&A documents - Classify as specific type of M&A agreement
          2. Compliance reports - Specify exact standard/framework
          3. Legal agreements - Use precise agreement types
          
          Return only a JSON object with:
          {
            "documentType": "specific document type",
            "category": "broader category",
            "confidence": number between 0 and 1,
            "metadata": {
              "industry": "relevant industry",
              "jurisdiction": "applicable jurisdiction",
              "regulatoryFramework": "relevant framework if applicable",
              "businessContext": "business context"
            }
          }`
        },
        {
          role: "user",
          content: `Classify this document:\n\n${content.substring(0, 4000)}`
        }
      ]
    });

    const result = response.content[0].text;
    return JSON.parse(result);
  }

  public refineClassification(rawClassification: DocumentClassification): DocumentClassification {
    const lowerContent = rawClassification.documentType.toLowerCase();
    
    // Check for specific document types
    for (const [category, info] of Object.entries(this.documentTypePatterns)) {
      for (const pattern of info.patterns) {
        if (lowerContent.includes(pattern)) {
          // Check for specific subtypes
          for (const [subPattern, subType] of Object.entries(info.subTypes)) {
            if (lowerContent.includes(subPattern)) {
              return {
                ...rawClassification,
                documentType: subType,
                category: info.category
              };
            }
          }
          
          // If no specific subtype found, use general category
          return {
            ...rawClassification,
            category: info.category
          };
        }
      }
    }

    return rawClassification;
  }
}

export const documentClassificationAgent = DocumentClassificationAgent.getInstance();
