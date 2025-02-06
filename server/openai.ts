import OpenAI from "openai";

// Using gpt-4 since gpt-4o is not available
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface DocumentAnalysis {
  summary: string;
  keyPoints: string[];
  suggestions: string[];
  riskScore: number;
}

interface AIResponse {
  summary: string;
  keyPoints: string[];
  suggestions: string[];
  riskScore: number;
}

export async function analyzeDocument(text: string): Promise<DocumentAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a legal document analysis expert. Analyze the provided document and return a JSON object with the following structure:
{
  "summary": "Brief summary of the document",
  "keyPoints": ["Array of key points"],
  "suggestions": ["Array of suggestions for improvement"],
  "riskScore": number from 1-10
}`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const analysis = JSON.parse(content) as AIResponse;

    return {
      summary: analysis.summary,
      keyPoints: analysis.keyPoints,
      suggestions: analysis.suggestions,
      riskScore: Math.max(1, Math.min(10, analysis.riskScore)),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error("Failed to analyze document: " + error.message);
    }
    throw new Error("Failed to analyze document: Unknown error");
  }
}