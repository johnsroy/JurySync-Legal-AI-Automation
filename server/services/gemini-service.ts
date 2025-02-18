import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../db";
import { legalResearchReports } from "@shared/schema";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateDeepResearch(query: string) {
  const model = genAI.getModel("gemini-1.5-pro");

  const prompt = `
    As a legal research expert, conduct a comprehensive analysis on the following query:
    "${query}"

    IMPORTANT: Respond ONLY with a valid JSON object in the following structure, with no additional text or formatting:
    {
      "executiveSummary": "Brief overview of key findings",
      "findings": [
        {
          "title": "Main point or case name",
          "source": "Source of information",
          "relevanceScore": 95,
          "summary": "Detailed explanation",
          "citations": ["Relevant citations"]
        }
      ],
      "recommendations": [
        "Action-oriented recommendations based on findings"
      ]
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Ensure we're only parsing valid JSON by removing any HTML-like content
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;

    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error("No valid JSON found in response");
    }

    const jsonStr = text.substring(jsonStart, jsonEnd);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error(`Invalid response format from AI model: ${error.message}`);
  }
}