import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface DocumentAnalysis {
  summary: string;
  keyPoints: string[];
  suggestions: string[];
  riskScore: number;
}

export async function analyzeDocument(text: string): Promise<DocumentAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a legal document analysis expert. Analyze the provided document and return a structured analysis with a summary, key points, suggestions for improvement, and a risk score from 1-10.",
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    return {
      summary: analysis.summary,
      keyPoints: analysis.keyPoints,
      suggestions: analysis.suggestions,
      riskScore: Math.max(1, Math.min(10, analysis.riskScore)),
    };
  } catch (error) {
    throw new Error("Failed to analyze document: " + error.message);
  }
}
