import OpenAI from "openai";
import type { AgentType } from "@shared/schema";

// Initialize OpenAI with the latest model
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface DraftRequirement {
  type: "STANDARD" | "CUSTOM" | "INDUSTRY_SPECIFIC";
  description: string;
  importance: "HIGH" | "MEDIUM" | "LOW";
  industry?: string;
  jurisdiction?: string;
  specialClauses?: string[];
}

interface GenerateDraftOptions {
  requirements: DraftRequirement[];
  baseContent?: string;
  customInstructions?: string;
  templateType?: "EMPLOYMENT" | "NDA" | "SERVICE_AGREEMENT" | "LEASE" | "GENERAL";
}

const TEMPLATE_PROMPTS = {
  EMPLOYMENT: "Create an employment contract with standard protections for both employer and employee",
  NDA: "Generate a comprehensive non-disclosure agreement with strong confidentiality provisions",
  SERVICE_AGREEMENT: "Draft a service agreement with clear deliverables and payment terms",
  LEASE: "Create a lease agreement with standard property rental terms",
  GENERAL: "Generate a general contract with standard legal protections"
};

export async function generateContractDraft({ requirements, baseContent, customInstructions, templateType = "GENERAL" }: GenerateDraftOptions): Promise<string> {
  try {
    let prompt = `As an expert legal contract drafter, generate a professional contract that incorporates these specific requirements:\n\n`;

    // Add template-specific guidance
    prompt += `${TEMPLATE_PROMPTS[templateType]}\n\n`;

    // Add requirements with structured formatting
    requirements.forEach(req => {
      prompt += `${req.importance} Priority Requirement [${req.type}]:
- Description: ${req.description}
${req.industry ? `- Industry Context: ${req.industry}\n` : ''}
${req.jurisdiction ? `- Jurisdiction: ${req.jurisdiction}\n` : ''}
${req.specialClauses ? `- Special Clauses Required:\n${req.specialClauses.map(c => `  * ${c}`).join('\n')}\n` : ''}
`;
    });

    if (customInstructions) {
      prompt += `\nSpecial Instructions:\n${customInstructions}\n`;
    }

    prompt += `\nPlease ensure the contract:
1. Uses precise legal language while maintaining clarity
2. Includes all standard protections and representations
3. Incorporates jurisdiction-specific requirements if specified
4. Follows best practices for the given contract type
5. Includes proper definitions and interpretation clauses
6. Maintains internal consistency throughout

Format the output as a properly structured legal document with clear section headings.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert legal contract drafting assistant with extensive knowledge of contract law, industry standards, and document automation. Your output should be precise, comprehensive, and follow legal best practices."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "text" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    return content;
  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    throw new Error(`Failed to generate contract draft: ${error.message}`);
  }
}

export async function analyzeContractClauses(content: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `As a legal contract analysis expert, analyze the given contract and provide detailed feedback in JSON format including:
1. Key clauses and their implications
2. Risk assessment for each major clause
3. Comparison against industry standards
4. Suggested improvements
5. Compliance requirements
6. Missing critical elements
7. Overall risk score`
        },
        {
          role: "user",
          content: `Analyze this contract and provide comprehensive feedback:\n\n${content}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const analysisContent = response.choices[0].message.content;
    if (!analysisContent) {
      throw new Error("Empty response from OpenAI");
    }

    return JSON.parse(analysisContent);
  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    throw new Error(`Failed to analyze contract: ${error.message}`);
  }
}

export async function compareVersions(originalContent: string, newContent: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `As a legal document comparison expert, analyze the differences between contract versions and provide detailed feedback in JSON format including:
1. Substantive changes to terms and conditions
2. Risk impact of changes
3. Recommendations for each change
4. Overall assessment
5. Version compatibility analysis`
        },
        {
          role: "user",
          content: `Compare these contract versions and provide comprehensive analysis:

Original Version:
${originalContent}

New Version:
${newContent}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const comparisonContent = response.choices[0].message.content;
    if (!comparisonContent) {
      throw new Error("Empty response from OpenAI");
    }

    return JSON.parse(comparisonContent);
  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    throw new Error(`Failed to compare versions: ${error.message}`);
  }
}