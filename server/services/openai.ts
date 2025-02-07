import OpenAI from "openai";
import type { AgentType } from "@shared/schema";
import { db } from "../db";
import { contractTemplates, templateCache } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Cache duration in hours
const CACHE_DURATION = 24;

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
  userId: number;
}

export async function generateContractDraft({ requirements, baseContent, customInstructions, templateType = "GENERAL", userId }: GenerateDraftOptions): Promise<{ content: string, sections: any[] }> {
  try {
    // Check cache first
    const cachedContent = await checkCache(userId, requirements, templateType);
    if (cachedContent) {
      return { content: cachedContent, sections: [] };
    }

    // Get relevant template
    const [template] = await db
      .select()
      .from(contractTemplates)
      .where(eq(contractTemplates.category, templateType))
      .limit(1);

    const prompt = `Generate a professional contract with the following structure:

1. Title
2. Parties Involved
3. Terms and Conditions
4. Signatures

Requirements:
${requirements.map(req => `
- ${req.importance} Priority [${req.type}]:
  ${req.description}
  ${req.industry ? `Industry: ${req.industry}` : ''}
  ${req.jurisdiction ? `Jurisdiction: ${req.jurisdiction}` : ''}
  ${req.specialClauses ? `Special Clauses: ${req.specialClauses.join(', ')}` : ''}
`).join('\n')}

${customInstructions ? `Additional Instructions: ${customInstructions}` : ''}

Format the response as a JSON object with this exact structure:
{
  "contract": {
    "title": "string",
    "content": "string",
    "sections": [
      {
        "heading": "string",
        "content": "string"
      }
    ]
  }
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a legal contract drafting expert. Generate contracts in valid JSON format following the specified structure exactly."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    // Validate JSON response
    let contractData;
    try {
      contractData = JSON.parse(content);
      if (!contractData.contract || !contractData.contract.content || !Array.isArray(contractData.contract.sections)) {
        throw new Error("Invalid contract format");
      }
    } catch (error) {
      console.error("JSON parsing error:", error);
      throw new Error("Failed to parse contract response");
    }

    // Save to cache if template exists
    if (template) {
      await saveToCache(userId, template.id, contractData.contract.content, requirements);
    }

    return {
      content: contractData.contract.content,
      sections: contractData.contract.sections
    };

  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    throw new Error(`Failed to generate contract draft: ${error.message}`);
  }
}

function formatContractContent(contract: any): string {
  let content = `${contract.title}\n\n`;

  contract.sections.forEach((section: any) => {
    content += `${section.heading}\n`;
    content += `${section.content}\n\n`;

    if (section.subsections) {
      section.subsections.forEach((subsection: any) => {
        content += `  ${subsection.heading}\n`;
        content += `  ${subsection.content}\n\n`;
      });
    }
  });

  return content;
}

// Function to check cache
async function checkCache(userId: number, requirements: DraftRequirement[], templateType: string) {
  const [cachedResult] = await db
    .select()
    .from(templateCache)
    .where(
      and(
        eq(templateCache.userId, userId),
        eq(templateCache.requirements, JSON.stringify(requirements))
      )
    )
    .limit(1);

  if (cachedResult && new Date(cachedResult.expiresAt) > new Date()) {
    return cachedResult.generatedContent;
  }

  return null;
}

// Function to save to cache
async function saveToCache(userId: number, templateId: number, content: string, requirements: DraftRequirement[]) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + CACHE_DURATION);

  await db.insert(templateCache).values({
    userId,
    templateId,
    generatedContent: content,
    requirements: requirements,
    expiresAt,
  });
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