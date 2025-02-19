import { openai } from "../openai";
import { db } from "../db";
import { contractTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import * as pdfParse from "pdf-parse";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

interface GenerateContractConfig {
  templateId: string;
  variables: Record<string, string>;
  customClauses?: string[];
  aiAssistance?: boolean;
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
    // Parse PDF content
    const data = await pdfParse(pdfBuffer);

    // Clean up and format the extracted text
    const cleanedText = data.text
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();

    // Format the text into sections
    return formatTemplateText(cleanedText);
  } catch (error) {
    console.error("PDF parsing error:", error);
    throw error;
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