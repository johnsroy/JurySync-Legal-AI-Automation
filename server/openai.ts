import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

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

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function analyzeDocument(text: string): Promise<DocumentAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`Attempt ${attempt + 1} to analyze document...`);

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
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
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      console.log("Successfully received OpenAI response");
      const analysis = JSON.parse(content) as AIResponse;

      return {
        summary: analysis.summary,
        keyPoints: analysis.keyPoints,
        suggestions: analysis.suggestions,
        riskScore: Math.max(1, Math.min(10, analysis.riskScore)),
      };
    } catch (error) {
      lastError = error as Error;
      console.error(`OpenAI API Error (Attempt ${attempt + 1}):`, error);

      if (error instanceof Error) {
        // If it's a rate limit error, wait and retry
        if (error.message.includes("429") || error.message.toLowerCase().includes("rate limit")) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          console.log(`Rate limit hit. Waiting ${delay}ms before retry...`);
          await wait(delay);
          continue;
        }
      }

      // For other errors, throw immediately
      throw new Error(`Failed to analyze document: ${lastError?.message}`);
    }
  }

  throw new Error(`Failed to analyze document after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}