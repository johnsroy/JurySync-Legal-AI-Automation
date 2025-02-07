import OpenAI from "openai";

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
      throw new Error("OpenAI API key is not configured");
    }

    const prompt = `Generate a ${templateType} contract with the following requirements:

${requirements.map(req => `- ${req.importance} Priority: ${req.description}`).join('\n')}

${customInstructions ? `Additional Instructions: ${customInstructions}` : ''}

Important: Return ONLY the contract text without any additional formatting or metadata.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a legal contract expert. Generate professional contract text based on the requirements provided. Return only the contract text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const contractText = response.choices[0].message.content;
    if (!contractText) {
      throw new Error("Failed to generate contract text");
    }

    return contractText;

  } catch (error: any) {
    console.error("Contract Generation Error:", error);
    throw new Error(error.message || "Failed to generate contract");
  }
}