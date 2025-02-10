import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export { openai };

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

export interface CustomInstructionSuggestion {
  suggestion: string;
  explanation: string;
  impact: string;
}

const commonRequirementsByTemplate: Record<string, string[]> = {
  "employment-standard": [
    "Include detailed job responsibilities and performance metrics",
    "Specify bonus structure and performance incentives",
    "Define work hours and location flexibility",
    "Include intellectual property assignment clause"
  ],
  // Add more common requirements for other templates...
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
6. If custom instructions are provided, adapt the contract accordingly while maintaining legal validity
7. Return only the complete contract text
8. Do not include any explanations or metadata in your response`;

    const userPrompt = `Base Template:
${template.baseContent}

Requirements (in order of importance):
${requirements.map(req => `[${req.importance}] ${req.description}`).join('\n')}

${customInstructions ? `\nCustom Instructions:\n${customInstructions}` : ''}

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

    const systemMessage = {
      role: "system",
      content: "You are a legal requirements expert. Return suggestions as a JSON array with each suggestion containing description, importance, and context fields. Include clear, specific, and actionable requirements."
    };

    const userMessage = {
      role: "user",
      content: JSON.stringify({
        template_name: template.name,
        template_category: template.category,
        template_description: template.description,
        current_requirement: currentDescription,
        request: "Suggest 3 relevant requirements that would enhance this contract template."
      })
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [systemMessage, userMessage],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    return result.suggestions || [];
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

    const systemMessage = {
      role: "system",
      content: "You are a legal contract expert. Based on the partial text, suggest completions that would make good contract requirements. Return response as JSON with suggestions array and context string."
    };

    const userMessage = {
      role: "user",
      content: JSON.stringify({
        template_name: template.name,
        template_category: template.category,
        partial_text: partialText,
        request: "Complete this requirement in a legally precise manner"
      })
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [systemMessage, userMessage],
      temperature: 0.3,
      response_format: { type: "json_object" }
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

export async function getCustomInstructionSuggestions(
  templateId: string,
  currentRequirements: ContractRequirement[]
): Promise<CustomInstructionSuggestion[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const template = getTemplate(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    const systemMessage = {
      role: "system",
      content: "You are a legal contract expert. Suggest custom instructions that would enhance the contract based on the template and current requirements. Return as JSON array with suggestion, explanation, and impact fields."
    };

    const userMessage = {
      role: "user",
      content: JSON.stringify({
        template_name: template.name,
        template_category: template.category,
        current_requirements: currentRequirements,
        request: "Suggest helpful custom instructions for this contract"
      })
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [systemMessage, userMessage],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    return result.suggestions || [];
  } catch (error: any) {
    console.error("Custom Instructions Suggestion Error:", error);
    throw new Error("Failed to generate custom instruction suggestions");
  }
}

import {getTemplate, type Template} from "./templateStore";
import {z} from "zod";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

const DocumentAnalysisSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  suggestions: z.array(z.string()),
  riskScore: z.number().min(0).max(10),
  contractDetails: z.object({
    parties: z.array(z.string()).optional(),
    effectiveDate: z.string().optional(),
    termLength: z.string().optional(),
    paymentTerms: z.string().optional(),
    governingLaw: z.string().optional(),
    keyObligations: z.array(z.string()).optional(),
    terminationClauses: z.array(z.string()).optional(),
    missingClauses: z.array(z.string()).optional(),
    suggestedClauses: z.array(z.string()).optional(),
    riskFactors: z.array(z.string()).optional(),
  }).optional(),
});

export async function analyzeDocument(content: string) {
  try {
    console.log('Starting document analysis...');

    // Clean content
    const cleanContent = content
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .replace(/[\uFFFD\uFFFE\uFFFF]/g, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .trim();

    if (!cleanContent) {
      throw new Error('Empty or invalid document content after cleaning');
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `Analyze this legal document and provide a comprehensive analysis in the following JSON format:
{
  "summary": "Brief overview of the document",
  "keyPoints": ["Array of key points"],
  "suggestions": ["Array of suggestions for improvement"],
  "riskScore": <number between 0 and 10>,
  "contractDetails": {
    "parties": ["Array of involved parties"],
    "effectiveDate": "Document effective date",
    "termLength": "Contract duration",
    "paymentTerms": "Payment terms summary",
    "governingLaw": "Applicable law",
    "keyObligations": ["Array of key obligations"],
    "terminationClauses": ["Array of termination conditions"],
    "missingClauses": ["Array of recommended missing clauses"],
    "suggestedClauses": ["Array of suggested improvements"],
    "riskFactors": ["Array of identified risk factors"]
  }
}

Document to analyze:
${cleanContent.substring(0, 8000)}`
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const responseText = response.choices[0].message.content;
    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }

    console.log('Received analysis response, parsing...');

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Raw response:', responseText);
      throw new Error('Failed to parse OpenAI response');
    }

    // Validate the response against our schema
    const validatedResponse = DocumentAnalysisSchema.parse(parsedResponse);
    console.log('Analysis validation successful');

    return validatedResponse;
  } catch (error: any) {
    console.error("Document analysis error:", error);
    throw new Error(`Failed to analyze document: ${error.message}`);
  }
}