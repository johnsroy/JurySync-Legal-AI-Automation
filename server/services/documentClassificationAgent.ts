import Anthropic from '@anthropic-ai/sdk';
import { openai } from "../openai";

// Initialize Anthropic client
// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
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

  private documentTypePatterns = {
    merger: {
      patterns: ['merger', 'acquisition', 'stock purchase', 'asset purchase', 'm&a', 'business combination'],
      category: 'M&A Agreement',
      subTypes: {
        'merger': 'M&A Deal - Merger',
        'stock purchase': 'M&A Deal - Stock Purchase',
        'asset purchase': 'M&A Deal - Asset Purchase',
        'acquisition': 'M&A Deal - Acquisition',
        'business combination': 'M&A Deal - Business Combination'
      }
    },
    compliance: {
      patterns: ['soc', 'iso', 'hipaa', 'gdpr', 'compliance', 'audit'],
      category: 'Compliance Document',
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

  private async analyzeKeywords(content: string): Promise<string[]> {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `Analyze the document for key identifying terms. Focus on:
            1. M&A related terms (merger, acquisition, stock purchase, etc.)
            2. Industry indicators (healthcare, technology, finance)
            3. Document type indicators (agreement, report, certification)
            Return only an array of lowercase keywords found, no other text.`
          },
          {
            role: "user",
            content: content.substring(0, 4000)
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(completion.choices[0].message.content);
      return result.keywords || [];
    } catch (error) {
      console.error("Keyword analysis failed:", error);
      return [];
    }
  }

  public async classifyDocument(content: string): Promise<DocumentClassification> {
    try {
      console.log("Starting document classification...");

      // First analyze keywords using GPT-4
      const keywords = await this.analyzeKeywords(content);
      console.log("Detected keywords:", keywords);

      // Check for M&A indicators first
      const isMandA = keywords.some(keyword => 
        this.documentTypePatterns.merger.patterns.some(pattern => 
          keyword.includes(pattern)
        )
      );

      if (isMandA) {
        console.log("M&A document detected, using specialized classification");
        const classification = await this.classifyWithOpenAI(content, true);
        const refinedResult = this.refineClassification(classification, keywords);
        console.log("Refined M&A classification:", refinedResult);
        return refinedResult;
      }

      // Standard classification flow
      const openAIResult = await this.classifyWithOpenAI(content);
      console.log("OpenAI Classification Result:", openAIResult);

      if (openAIResult.confidence > 0.8) {
        const refinedResult = this.refineClassification(openAIResult, keywords);
        console.log("Using OpenAI classification with refinements:", refinedResult);
        return refinedResult;
      }

      // Fallback to Anthropic
      console.log("Falling back to Anthropic for detailed analysis...");
      const anthropicResult = await this.classifyWithAnthropic(content);
      console.log("Anthropic Classification Result:", anthropicResult);

      const refinedAnthropicResult = this.refineClassification(anthropicResult, keywords);
      console.log("Final refined classification:", refinedAnthropicResult);
      return refinedAnthropicResult;

    } catch (error) {
      console.error("Document classification error:", error);
      throw new Error("Failed to classify document");
    }
  }

  private async classifyWithOpenAI(content: string, isMandA: boolean = false): Promise<DocumentClassification> {
    const systemPrompt = isMandA ? 
      `You are an expert M&A document classifier. Analyze this document and classify it as an M&A Deal with the specific type (Merger, Stock Purchase, Asset Purchase, etc.).
      Be very specific about the type of M&A transaction.` :
      `You are an expert document classifier specializing in legal and business documents.
      Analyze the document content and provide detailed classification.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `${systemPrompt}

          Return a JSON object with:
          {
            "documentType": "specific document type (prefix with 'M&A Deal - ' for M&A documents)",
            "category": "broader category (e.g., M&A Agreement, Legal Agreement)",
            "confidence": number between 0 and 1,
            "complianceStatus": "Compliant" | "Non-Compliant" | "Needs Review",
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
          content: `Classify this document content:\n\n${content.substring(0, 4000)}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    console.log("OpenAI Classification:", result);
    return result;
  }

  private async classifyWithAnthropic(documentText: string): Promise<DocumentClassification> {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are an expert document classifier specializing in legal and business documents.
        Analyze the following document and classify it with high precision.

        Focus on:
        1. M&A documents - Specifically classify as "M&A Deal - [Type]"
        2. Legal agreements - Identify exact agreement type
        3. Compliance documents - Specify standards/frameworks

        Return only a JSON object with:
        {
          "documentType": "specific document type",
          "category": "broader category",
          "confidence": number between 0 and 1,
          "complianceStatus": "Compliant" | "Non-Compliant" | "Needs Review",
          "metadata": {
            "industry": "relevant industry",
            "jurisdiction": "applicable jurisdiction",
            "regulatoryFramework": "relevant framework if applicable",
            "businessContext": "business context"
          }
        }

        Document content to classify:\n\n${documentText.substring(0, 4000)}`
      }]
    });

    const responseContent = response.content[0];
    if (!responseContent || !('text' in responseContent)) {
      throw new Error('Invalid response format from AI');
    }

    try {
      const result = JSON.parse(responseContent.text);
      console.log("Anthropic Classification:", result);
      return result;
    } catch (error) {
      console.error("Failed to parse Anthropic response:", error);
      throw new Error('Failed to parse AI response');
    }
  }

  public refineClassification(rawClassification: DocumentClassification, keywords: string[] = []): DocumentClassification {
    console.log("Starting classification refinement for:", rawClassification.documentType);
    const lowerContent = rawClassification.documentType.toLowerCase();

    // First, check for M&A documents using keywords
    const isMandA = keywords.some(keyword => 
      this.documentTypePatterns.merger.patterns.some(pattern => 
        keyword.includes(pattern)
      )
    );

    if (isMandA) {
      let mandAType = 'General';
      // Determine specific M&A type
      for (const [subPattern, subType] of Object.entries(this.documentTypePatterns.merger.subTypes)) {
        if (keywords.some(k => k.includes(subPattern))) {
          mandAType = subType;
          break;
        }
      }

      console.log(`Identified as M&A document: ${mandAType}`);
      return {
        ...rawClassification,
        documentType: mandAType,
        category: 'M&A Agreement',
        complianceStatus: rawClassification.complianceStatus || "Needs Review"
      };
    }

    // Check for specific document types
    for (const [category, info] of Object.entries(this.documentTypePatterns)) {
      for (const pattern of info.patterns) {
        if (lowerContent.includes(pattern) || keywords.some(k => k.includes(pattern))) {
          // Check for specific subtypes
          for (const [subPattern, subType] of Object.entries(info.subTypes)) {
            if (lowerContent.includes(subPattern) || keywords.some(k => k.includes(subPattern))) {
              console.log(`Refined classification: ${subType} in category ${info.category}`);
              return {
                ...rawClassification,
                documentType: subType,
                category: info.category,
                complianceStatus: rawClassification.complianceStatus || "Needs Review"
              };
            }
          }

          // For other categories, use general category
          console.log(`Using general category: ${info.category}`);
          return {
            ...rawClassification,
            category: info.category,
            complianceStatus: rawClassification.complianceStatus || "Needs Review"
          };
        }
      }
    }

    console.log("No specific refinement found, returning with default values");
    return {
      ...rawClassification,
      complianceStatus: rawClassification.complianceStatus || "Needs Review",
      category: rawClassification.category || "Unclassified"
    };
  }
}

export const documentClassificationAgent = DocumentClassificationAgent.getInstance();