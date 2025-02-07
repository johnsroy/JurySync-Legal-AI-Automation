import OpenAI from "openai";
import { getTemplate, type Template } from "./templateStore";
import { z } from "zod";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ContractRequirement {
  description: string;
  importance: "HIGH" | "MEDIUM" | "LOW";
}

export interface RequirementSuggestion {
  description: string;
  importance: "HIGH" | "MEDIUM" | "LOW";
  context: string;
}

export interface AutocompleteResponse {
  suggestions: string[];
  context?: string;
}

const commonRequirementsByTemplate: Record<string, string[]> = {
  "employment-standard": [
    "Include detailed job responsibilities and performance metrics",
    "Specify bonus structure and performance incentives",
    "Define work hours and location flexibility",
    "Include intellectual property assignment clause"
  ],
  "nda-standard": [
    "Define scope of confidential information",
    "Specify duration of confidentiality obligations",
    "Include return or destruction of confidential materials",
    "Add exceptions for legally required disclosures"
  ],
  "service-agreement": [
    "Define service level agreements (SLAs)",
    "Include payment terms and late payment penalties",
    "Specify termination conditions and notice periods",
    "Detail warranty and liability limitations"
  ]
};

export async function generateContract(
  templateId: string,
  requirements: ContractRequirement[],
  customInstructions?: string
): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const template = getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const systemPrompt = `You are an expert legal contract generator.
Task: Enhance the provided contract template based on specific requirements while maintaining legal validity and clarity.

Instructions:
1. Use the base template as your foundation
2. Incorporate all requirements based on their priority level
3. Maintain professional legal language and formatting
4. Ensure all critical template variables are properly addressed
5. Add any necessary clauses based on the requirements
6. Return only the complete contract text
7. Do not include any explanations or metadata in your response`;

    const userPrompt = `Base Template:
${template.baseContent}

Requirements (in order of importance):
${requirements.map(req => `[${req.importance}] ${req.description}`).join('\n')}

${customInstructions ? `\nAdditional Instructions:\n${customInstructions}` : ''}

Required Variables:
${template.variables.filter(v => v.required).map(v => `- ${v.name}: ${v.description}`).join('\n')}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2500,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    const contractText = response.choices[0]?.message?.content;
    if (!contractText) {
      throw new Error("Failed to generate contract text");
    }

    return contractText.trim();
  } catch (error: any) {
    console.error("Contract Generation Error:", error);
    throw new Error(error.message || "Failed to generate contract");
  }
}

export async function suggestRequirements(
  templateId: string,
  currentDescription?: string
): Promise<RequirementSuggestion[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const template = getTemplate(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    const basePrompt = `Based on the ${template.name} template and ${
      currentDescription ? `the current requirement: "${currentDescription}",` : ""
    } suggest 3 relevant additional requirements. For each suggestion, include a description, importance level, and context.

Template category: ${template.category}
Template description: ${template.description}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a legal requirements expert. Provide specific, contextual suggestions for contract requirements."
        },
        { role: "user", content: basePrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const suggestions = JSON.parse(response.choices[0]?.message?.content || "{}");
    return suggestions.suggestions || [];
  } catch (error: any) {
    console.error("Requirement Suggestion Error:", error);
    throw new Error("Failed to generate requirement suggestions");
  }
}

export async function getAutocomplete(
  templateId: string,
  partialText: string
): Promise<AutocompleteResponse> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const template = getTemplate(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    // First, check if we have common requirements that match
    const commonSuggestions = commonRequirementsByTemplate[templateId]?.filter(req =>
      req.toLowerCase().includes(partialText.toLowerCase())
    ) || [];

    // If we have enough common suggestions, return those
    if (commonSuggestions.length >= 3) {
      return {
        suggestions: commonSuggestions.slice(0, 3),
        context: "Based on common requirements"
      };
    }

    // Otherwise, use AI to generate contextual suggestions
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a legal requirements expert. Provide autocomplete suggestions for contract requirements."
        },
        {
          role: "user",
          content: `Given the partial text "${partialText}" for a ${template.name} (${template.category}), suggest 3 completions that would make good contract requirements.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    return {
      suggestions: result.suggestions || [],
      context: result.context || "AI-generated suggestions"
    };
  } catch (error: any) {
    console.error("Autocomplete Error:", error);
    throw new Error("Failed to generate autocomplete suggestions");
  }
}

export async function analyzeDocument(content: string): Promise<{
  summary: string;
  key_points: string[];
  suggestions: string[];
}> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a legal document analyzer. Analyze the provided document and return a JSON object with a summary, key points, and suggestions for improvement."
        },
        {
          role: "user",
          content: `Analyze this document:\n\n${content}`
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(response.choices[0]?.message?.content || "{}");
    return {
      summary: analysis.summary || "No summary available",
      key_points: analysis.key_points || [],
      suggestions: analysis.suggestions || []
    };
  } catch (error: any) {
    console.error("Document Analysis Error:", error);
    throw new Error(error.message || "Failed to analyze document");
  }
}