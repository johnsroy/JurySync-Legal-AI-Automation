import OpenAI from "openai";
import { getTemplate } from "./templateStore";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateContract(
  templateType: string,
  requirements: Array<{
    type: string;
    description: string;
    importance: string;
  }>,
  customInstructions?: string
): Promise<string> {
  try {
    // Get base template
    const template = getTemplate(templateType);
    if (!template) {
      throw new Error(`Template type ${templateType} not found`);
    }

    const prompt = `Enhance and customize this ${template.name} template based on the following requirements:

Base Template:
${template.baseContent}

Requirements:
${requirements.map(req => `- ${req.importance} Priority: ${req.description}`).join('\n')}

${customInstructions ? `Additional Instructions: ${customInstructions}` : ''}

Important: Generate a complete, professional contract by enhancing the base template. Return only the final contract text.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a legal contract expert. Enhance and customize the provided contract template based on specific requirements. 
Return only the final contract text without any additional formatting or metadata.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2500
    });

    const contractText = response.choices[0].message.content;
    if (!contractText) {
      throw new Error("Failed to generate contract text");
    }

    return contractText.trim();

  } catch (error: any) {
    console.error("Contract Generation Error:", error);
    throw new Error(error.message || "Failed to generate contract");
  }
}