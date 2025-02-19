import { openai } from "../openai";
import { db } from "../db";
import { contractTemplates } from "@shared/schema";

interface GenerateContractConfig {
  templateId: string;
  variables: Record<string, string>;
  customClauses?: string[];
  aiAssistance?: boolean;
}

export async function generateContract(config: GenerateContractConfig) {
  try {
    const { templateId, variables, customClauses, aiAssistance } = config;

    // Get template from database
    const [template] = await db
      .select()
      .from(contractTemplates)
      .where(eq(contractTemplates.id, templateId));

    if (!template) {
      throw new Error("Template not found");
    }

    let content = template.content;

    // Replace variables in the template
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    // If AI assistance is enabled, use GPT-4 to enhance the contract
    if (aiAssistance) {
      const prompt = `Please review and enhance this contract while maintaining its legal validity:
      
      ${content}
      
      Additional clauses to consider: ${customClauses?.join("\n") || "None"}
      
      Please provide the enhanced contract text maintaining proper formatting.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Using the latest model
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 4000
      });

      content = response.choices[0].message.content || content;
    }

    return content;
  } catch (error) {
    console.error("Contract generation error:", error);
    throw error;
  }
}
