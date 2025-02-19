import { openai } from "../openai";
import { db } from "../db";
import { contractTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import PDFParser from 'pdf2json';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

interface GenerateContractConfig {
  templateId: string;
  variables: Record<string, string>;
  customClauses?: string[];
  aiAssistance?: boolean;
}

export interface FieldSuggestion {
  field: string;
  suggestions: string[];
  description: string;
  fieldType: 'date' | 'name' | 'address' | 'company' | 'amount' | 'other';
}

// Service class to handle contract generation and related functionality
class ContractService {
  private pdfParser: PDFParser | null = null;

  private getPDFParser() {
    if (!this.pdfParser) {
      this.pdfParser = new PDFParser();
    }
    return this.pdfParser;
  }

  async generateContract(config: GenerateContractConfig) {
    try {
      const { templateId, variables, customClauses, aiAssistance = true } = config;

      // Get template from database
      const [template] = await db
        .select()
        .from(contractTemplates)
        .where(eq(contractTemplates.id, parseInt(templateId)));

      if (!template) {
        throw new Error("Template not found");
      }

      let content = template.content;

      // Replace variables in the template
      Object.entries(variables).forEach(([key, value]) => {
        content = content.replace(new RegExp(`\\[${key}\\]`, "g"), value);
      });

      // If AI assistance is enabled, use GPT-4o to enhance the contract
      if (aiAssistance) {
        const prompt = `As a legal contract expert, please review and enhance this contract while maintaining its legal validity:

        ${content}

        Additional clauses to consider: ${customClauses?.join("\n") || "None"}

        Please analyze the contract for:
        1. Legal completeness and validity
        2. Clarity and readability
        3. Potential risks or ambiguities
        4. Compliance with standard legal practices

        Return the enhanced contract text while maintaining proper formatting and incorporating the suggested improvements.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an expert legal contract analyst specializing in contract optimization and risk assessment."
            },
            { 
              role: "user", 
              content: prompt 
            }
          ],
          temperature: 0.3,
          max_tokens: 4000
        });

        content = response.choices[0].message.content || content;

        // Get additional analysis and metadata
        const analysisPrompt = `Please analyze this contract and provide a JSON response with the following metadata:
        {
          "complexity": "LOW"|"MEDIUM"|"HIGH",
          "estimatedTime": string (e.g. "30 minutes"),
          "riskAreas": string[],
          "recommendations": string[],
          "industryContext": string,
          "complianceNotes": string[]
        }`;

        const analysisResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a legal contract analysis expert providing structured metadata about contracts."
            },
            {
              role: "user",
              content: content + "\n\n" + analysisPrompt
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2
        });

        const metadata = JSON.parse(analysisResponse.choices[0].message.content || "{}");

        return {
          content,
          metadata
        };
      }

      return { content };
    } catch (error) {
      console.error("Contract generation error:", error);
      throw error;
    }
  }

  async parsePdfTemplate(pdfBuffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const parser = this.getPDFParser();

      parser.on("pdfParser_dataReady", (pdfData: any) => {
        try {
          const content = pdfData.Pages
            .map((page: any) => page.Texts
              .map((text: any) => decodeURIComponent(text.R[0].T))
              .join(' ')
            )
            .join('\n');
          resolve(this.formatTemplateText(content));
        } catch (error: any) {
          reject(new Error(`PDF parsing failed: ${error.message}`));
        }
      });

      parser.on("pdfParser_dataError", (error: any) => {
        reject(new Error(`PDF parsing error: ${error}`));
      });

      try {
        parser.parseBuffer(pdfBuffer);
      } catch (error: any) {
        reject(new Error(`Failed to start PDF parsing: ${error.message}`));
      }
    });
  }

  private formatTemplateText(text: string): string {
    // Enhanced formatting logic
    const sections = text.split(/(?:\r?\n){2,}/);

    return sections
      .map(section => {
        // Detect and format section headers
        if (/^\d+\.\s+[A-Z][A-Z\s]+:?/.test(section)) {
          return `\n${section.trim()}\n`;
        }
        // Format normal paragraphs
        return section.trim();
      })
      .filter(Boolean)
      .join('\n\n');
  }

  async generateTemplatePreview(category: string): Promise<string> {
    const prompt = `Generate a professional legal contract template for category: ${category}. 
      Include all standard sections, clauses, and formatting. 
      Use placeholder variables in [VARIABLE_NAME] format.

      Follow this structure:
      1. Title and Date
      2. Parties involved
      3. Recitals/Background
      4. Definitions
      5. Main terms and conditions
      6. Standard clauses
      7. Signature block

      Ensure proper formatting with:
      - Clear section numbering
      - Proper indentation
      - Variable placeholders in brackets
      - Professional legal language`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a legal contract expert specializing in generating professional contract templates."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 3000
    });

    return response.choices[0].message.content || "";
  }

  async generateSmartSuggestions(selectedText: string, contractContent: string): Promise<FieldSuggestion[]> {
    try {
      const prompt = `Analyze this selected text from a legal contract and generate smart suggestions.
      Selected text: "${selectedText}"
      Contract context: "${contractContent}"

      Focus on:
      1. Identifying the type of field (date, name, address, company, amount)
      2. Providing contextually relevant suggestions
      3. Explaining the field's purpose
      4. Including smart defaults (today's date for dates, common values for other fields)

      Return a JSON object with:
      {
        "field": "Descriptive field name",
        "fieldType": "date"|"name"|"address"|"company"|"amount"|"other",
        "suggestions": ["suggestion1", "suggestion2", "suggestion3"],
        "description": "Detailed description of what this field represents"
      }`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a legal document expert specializing in smart field analysis and suggestions."
          },
          { 
            role: "user", 
            content: prompt 
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");

      // Add smart defaults based on field type
      if (result.fieldType === 'date') {
        const today = new Date().toISOString().split('T')[0];
        if (!result.suggestions.includes(today)) {
          result.suggestions.unshift(today);
        }
      } else if (result.fieldType === 'company') {
        result.suggestions = [
          ...result.suggestions,
          "Your Organization Name",
          "Client Company Name",
          "Parent Company, Inc."
        ];
      } else if (result.fieldType === 'address') {
        result.suggestions = [
          ...result.suggestions,
          "123 Business Street, Suite 100, City, State 12345",
          "Your Organization Address",
          "Client Address"
        ];
      }

      return [result];
    } catch (error) {
      console.error("Failed to generate smart suggestions:", error);
      throw error;
    }
  }
}

// Export a single instance of the service
export const contractService = new ContractService();