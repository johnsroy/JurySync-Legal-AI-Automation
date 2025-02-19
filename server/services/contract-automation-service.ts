import { openai } from "../openai";
import { db } from "../db";
import { contractTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";
import PDFNet from '@pdftron/pdfnet-node';

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
  selected?: boolean;
}

// Helper function to extract all placeholders from content
function extractPlaceholders(content: string): string[] {
  const placeholderRegex = /\[([^\]]+)\]/g;
  const matches = content.match(placeholderRegex);
  return matches ? matches.map(m => m.slice(1, -1)) : [];
}

// Helper to determine field type based on name and context
function determineFieldType(fieldName: string, context: string): 'date' | 'name' | 'address' | 'company' | 'amount' | 'other' {
  const fieldLower = fieldName.toLowerCase();

  // Enhanced type detection with context analysis
  if (fieldLower.includes('date') || fieldLower.includes('period') || fieldLower.includes('term')) return 'date';
  if (fieldLower.includes('name') || fieldLower.includes('signer') || fieldLower.includes('party')) return 'name';
  if (fieldLower.includes('address') || fieldLower.includes('location')) return 'address';
  if (fieldLower.includes('company') || fieldLower.includes('firm') || fieldLower.includes('organization') || fieldLower.includes('business')) return 'company';
  if (fieldLower.includes('amount') || fieldLower.includes('rate') || fieldLower.includes('fee') || fieldLower.includes('payment') || fieldLower.includes('price')) return 'amount';

  // Context-based detection
  if (context.toLowerCase().includes(`${fieldLower} shall pay`)) return 'amount';
  if (context.toLowerCase().includes(`located at ${fieldLower}`)) return 'address';
  if (context.toLowerCase().includes(`represented by ${fieldLower}`)) return 'name';

  return 'other';
}

export async function generateSmartSuggestions(selectedText: string, contractContent: string): Promise<FieldSuggestion[]> {
  try {
    // Extract all unique placeholders
    const allPlaceholders = extractPlaceholders(contractContent);
    const uniquePlaceholders = [...new Set(allPlaceholders)];

    // If there's selected text, prioritize that placeholder
    let selectedPlaceholder = '';
    if (selectedText) {
      const selected = extractPlaceholders(selectedText);
      selectedPlaceholder = selected[0] || '';
    }

    // First, get contract type and context analysis
    const contextAnalysis = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a legal document expert. Analyze this contract to understand its type and key elements."
        },
        {
          role: "user",
          content: `Analyze this contract and provide key context about the type of agreement and expected fields:\n\n${contractContent}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const contractAnalysis = JSON.parse(contextAnalysis.choices[0].message.content || "{}");

    // Generate suggestions for all placeholders
    const prompt = `As a legal contract expert, provide intelligent suggestions for each placeholder in this ${contractAnalysis.contractType} agreement.

Contract Context:
${contractContent}

Selected Placeholder (prioritize if present): ${selectedPlaceholder}

For each of these placeholders, provide a JSON object with context-appropriate suggestions:
${uniquePlaceholders.join('\n')}

Response should be an array of objects with this structure:
{
  "field": "placeholder name",
  "fieldType": "date" | "name" | "address" | "company" | "amount" | "other",
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"],
  "description": "Clear description of what this field represents in the contract"
}

Ensure suggestions are:
1. Contextually appropriate for the contract type
2. Realistic and professionally formatted
3. Include common/standard values for the field type
4. Consider industry standards and legal requirements`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a legal document expert specializing in ${contractAnalysis.contractType} agreements. Generate professional, context-aware suggestions for contract fields.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const suggestions = JSON.parse(response.choices[0].message.content || "[]");

    // Enhance suggestions with smart defaults and validation
    return suggestions.map((suggestion: FieldSuggestion) => {
      const fieldType = determineFieldType(suggestion.field, contractContent);

      // Add smart defaults based on field type
      if (fieldType === 'date') {
        const today = new Date().toISOString().split('T')[0];
        const nextMonth = new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0];
        const nextYear = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];

        suggestion.suggestions = [today, nextMonth, nextYear, ...suggestion.suggestions].slice(0, 5);
      }

      // Ensure all suggestions are unique
      suggestion.suggestions = [...new Set(suggestion.suggestions)];

      // Move selected placeholder to the top if present
      if (selectedPlaceholder && suggestion.field === selectedPlaceholder) {
        suggestion.selected = true;
      }

      return {
        ...suggestion,
        fieldType
      };
    }).sort((a, b) => {
      // Sort with selected placeholder first, then by field type importance
      if (a.selected) return -1;
      if (b.selected) return 1;
      return 0;
    });
  } catch (error) {
    console.error("Failed to generate smart suggestions:", error);
    throw error;
  }
}

export async function generateContract(config: GenerateContractConfig) {
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

export async function parsePdfTemplate(pdfBuffer: Buffer): Promise<string> {
  try {
    await PDFNet.initialize();

    const doc = await PDFNet.PDFDoc.createFromBuffer(pdfBuffer);
    await doc.initSecurityHandler();

    let extractedText = '';
    const pageCount = await doc.getPageCount();

    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const reader = await PDFNet.TextExtractor.create();
      reader.begin(page);

      // Get all text blocks
      const blocks = await reader.getAsText();
      extractedText += blocks + '\n';
    }

    // Clean up extracted text
    const cleanedText = extractedText
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();

    // Format the text into sections
    return formatTemplateText(cleanedText);
  } catch (error) {
    console.error("PDF parsing error:", error);
    throw new Error(`Enhanced PDF parsing failed: ${error.message}`);
  } finally {
    await PDFNet.terminate();
  }
}

function formatTemplateText(text: string): string {
  // Split into sections based on common patterns
  const sections = text.split(/(\d+\.\s+[A-Z][A-Z\s]+:?|\n[A-Z][A-Z\s]+:)/g);

  // Rejoin with proper formatting
  return sections
    .map(section => section.trim())
    .filter(Boolean)
    .join('\n\n');
}

export async function generateTemplatePreview(category: string): Promise<string> {
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