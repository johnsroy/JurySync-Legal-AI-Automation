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

  private documentTypePatterns = {
    merger: {
      patterns: ['merger', 'acquisition', 'stock purchase', 'asset purchase', 'm&a', 'business combination'],
      category: 'M&A Deal',
      subTypes: {
        'merger': 'M&A Deal',
        'stock purchase': 'M&A Deal',
        'asset purchase': 'M&A Deal',
        'acquisition': 'M&A Deal',
        'business combination': 'M&A Deal'
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
    }
  };

  public static getInstance(): DocumentClassificationAgent {
    if (!DocumentClassificationAgent.instance) {
      DocumentClassificationAgent.instance = new DocumentClassificationAgent();
    }
    return DocumentClassificationAgent.instance;
  }

  private constructor() {}

  private async analyzeWithGPT4(content: string): Promise<string[]> {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `Analyze this document and extract key identifying terms, focusing especially on:
            1. M&A related terms (merger, acquisition, purchase agreement, etc.)
            2. Industry indicators
            3. Document type indicators
            Return only the key terms found as a JSON array of strings.`
          },
          {
            role: "user",
            content: content.substring(0, 4000)
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(completion.choices[0].message.content);
      return result.terms || [];
    } catch (error) {
      console.error("GPT-4 analysis failed:", error);
      return [];
    }
  }

  public async classifyDocument(content: string): Promise<DocumentClassification> {
    try {
      console.log("Starting document classification with enhanced M&A detection...");

      // First analyze with GPT-4 to extract key terms
      const terms = await this.analyzeWithGPT4(content);
      console.log("Extracted terms:", terms);

      // Check for M&A indicators first
      const isMandA = terms.some(term => 
        this.documentTypePatterns.merger.patterns.some(pattern => 
          term.toLowerCase().includes(pattern)
        )
      );

      if (isMandA) {
        console.log("M&A document detected, classifying as M&A Deal");
        return {
          documentType: "M&A Deal",
          category: "M&A Deal",
          confidence: 0.95,
          complianceStatus: "Needs Review",
          metadata: {
            industry: this.detectIndustry(terms),
            businessContext: "Mergers & Acquisitions"
          }
        };
      }

      // If not M&A, proceed with standard classification
      const classification = await this.classifyWithOpenAI(content);
      console.log("Standard classification result:", classification);

      return classification;

    } catch (error) {
      console.error("Document classification error:", error);
      throw new Error("Failed to classify document");
    }
  }

  private detectIndustry(terms: string[]): string {
    const industryTerms: { [key: string]: string } = {
      'tech': 'TECHNOLOGY',
      'software': 'TECHNOLOGY',
      'healthcare': 'HEALTHCARE',
      'medical': 'HEALTHCARE',
      'financial': 'FINANCIAL',
      'banking': 'FINANCIAL',
      'manufacturing': 'MANUFACTURING',
      'retail': 'RETAIL'
    };

    for (const term of terms) {
      for (const [key, value] of Object.entries(industryTerms)) {
        if (term.toLowerCase().includes(key)) {
          return value;
        }
      }
    }

    return 'TECHNOLOGY'; // Default industry
  }

  private async classifyWithOpenAI(content: string): Promise<DocumentClassification> {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an expert document classifier.
          Analyze this document and provide a detailed classification.
          For M&A documents, always classify as 'M&A Deal'.
          For all other documents, determine the most appropriate type.
          Return a JSON object with the classification details.`
        },
        {
          role: "user",
          content: content.substring(0, 4000)
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    return {
      documentType: result.documentType,
      category: result.category,
      confidence: result.confidence || 0.8,
      complianceStatus: result.complianceStatus || "Needs Review",
      metadata: {
        industry: result.metadata?.industry || "TECHNOLOGY",
        jurisdiction: result.metadata?.jurisdiction,
        regulatoryFramework: result.metadata?.regulatoryFramework,
        businessContext: result.metadata?.businessContext
      }
    };
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
}

export const documentClassificationAgent = DocumentClassificationAgent.getInstance();