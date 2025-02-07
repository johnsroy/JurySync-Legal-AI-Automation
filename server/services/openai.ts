import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ContractRequirement {
  type: "STANDARD" | "CUSTOM" | "INDUSTRY_SPECIFIC";
  description: string;
  importance: "HIGH" | "MEDIUM" | "LOW";
}

export async function generateContract(
  templateType: string,
  requirements: ContractRequirement[],
  customInstructions?: string
): Promise<{ content: string }> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured");
    }

    const prompt = `Create a ${templateType} contract with these requirements:
${requirements.map(req => 
  `- ${req.importance} Priority [${req.type}]: ${req.description}`
).join('\n')}

${customInstructions ? `Additional Instructions: ${customInstructions}` : ''}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are a legal contract expert. Generate professional contracts based on requirements." 
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content generated");
    }

    return { content };

  } catch (error: any) {
    console.error("Contract Generation Error:", error);
    throw new Error(error.message || "Failed to generate contract");
  }
}