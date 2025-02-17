import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../db";
import { legalResearchReports } from "@shared/schema";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateDeepResearch(query: string, jurisdiction: string, legalTopic: string, dateRange: { start?: string; end?: string }) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  const prompt = `
    As a legal research expert specializing in ${jurisdiction} jurisdiction and ${legalTopic},
    conduct a comprehensive analysis with deep research capabilities.
    
    Query: ${query}
    Date Range: ${dateRange.start ? `${dateRange.start} to ${dateRange.end}` : 'No specific range'}
    
    Provide a detailed analysis including:
    1. Key legal precedents in ${jurisdiction}
    2. Statutory framework for ${legalTopic}
    3. Recent judicial interpretations
    4. Academic commentary
    5. Practical implications
    
    Format the response as a JSON object with:
    {
      "summary": "One-page executive summary",
      "keyFindings": [
        {
          "title": "string",
          "content": "string",
          "citations": ["string"],
          "urls": ["string"]
        }
      ],
      "recommendations": ["string"],
      "relatedQueries": ["string"]
    }
  `;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Invalid response format from AI model");
  }
}
