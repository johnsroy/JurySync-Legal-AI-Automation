import OpenAI from "openai";
import type { AgentType } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface DraftRequirement {
  type: "STANDARD" | "CUSTOM";
  description: string;
  importance: "HIGH" | "MEDIUM" | "LOW";
}

interface GenerateDraftOptions {
  requirements: DraftRequirement[];
  baseContent?: string;
  customInstructions?: string;
}

export async function generateContractDraft({ requirements, baseContent, customInstructions }: GenerateDraftOptions): Promise<string> {
  try {
    let prompt = `As a legal expert, generate a professional contract draft that incorporates the following requirements:\n\n`;

    // Add requirements to prompt
    requirements.forEach(req => {
      prompt += `- [${req.importance}] ${req.type === 'STANDARD' ? '[Standard Clause]' : '[Custom]'} ${req.description}\n`;
    });

    if (customInstructions) {
      prompt += `\nAdditional Instructions:\n${customInstructions}\n`;
    }

    if (baseContent) {
      prompt += `\nBase content to work from:\n${baseContent}\n`;
    }

    prompt += `\nPlease generate a comprehensive contract that:
    1. Incorporates all specified requirements
    2. Uses clear, legally precise language
    3. Follows standard contract structure
    4. Includes all necessary legal protections

    Format the output as a properly structured legal document.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert legal contract drafting assistant with extensive knowledge of contract law and document automation."
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
          content: `You are a legal contract analysis expert. Analyze the given contract and provide structured feedback in JSON format. Include:
          1. Key clauses and their implications
          2. Potential risks and missing elements
          3. Compliance considerations
          4. Suggested improvements`
        },
        {
          role: "user",
          content: `Analyze this contract and provide feedback on its clauses:\n\n${content}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    return JSON.parse(content);
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
          content: "You are a legal document comparison expert. Compare the two versions of the contract and identify meaningful changes."
        },
        {
          role: "user",
          content: `Compare these two contract versions and identify meaningful changes:

          Original Version:
          ${originalContent}

          New Version:
          ${newContent}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    return JSON.parse(content);
  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    throw new Error(`Failed to compare versions: ${error.message}`);
  }
}