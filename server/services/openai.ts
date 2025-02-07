import OpenAI from "openai";
import { getTemplate } from "./templateStore";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
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
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const template = getTemplate(templateType);
    if (!template) {
      throw new Error(`Template type ${templateType} not found`);
    }

    const systemPrompt = `You are an expert legal contract generator. Your task is to enhance the provided contract template based on specific requirements.
Key instructions:
- Use the base template as a foundation
- Incorporate all requirements based on their priority
- Maintain professional legal language
- Return only the complete contract text
- Do not include any explanations or metadata`;

    const userPrompt = `Base Template:
${template.baseContent}

Requirements to incorporate (in order of importance):
${requirements.map(req => `- ${req.importance} Priority: ${req.description}`).join('\n')}
${customInstructions ? `\nAdditional Instructions:\n${customInstructions}` : ''}`;

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