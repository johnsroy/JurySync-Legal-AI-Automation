import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
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
): Promise<string> {
  try {
    const prompt = `Create a ${templateType} contract with these requirements:
${requirements.map(req => 
  `- ${req.importance} Priority [${req.type}]: ${req.description}`
).join('\n')}

${customInstructions ? `Additional Instructions: ${customInstructions}` : ''}

Provide only the contract text, no formatting or metadata.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are a legal contract expert. Generate professional contracts based on requirements. Return only the plain contract text." 
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

    return content;

  } catch (error: any) {
    console.error("Contract Generation Error:", error);
    throw new Error(error.message || "Failed to generate contract");
  }
}