import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../db";
import { legalResearchReports } from "@shared/schema";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface ResearchFilters {
  jurisdiction?: string;
  legalTopic?: string;
  dateRange?: {
    start?: string;
    end?: string;
  };
}

export async function generateDeepResearch(query: string, filters?: ResearchFilters) {
  const model = genAI.getModel("gemini-1.5-pro");

  const jurisdictionContext = filters?.jurisdiction ? 
    `focusing on ${filters.jurisdiction} jurisdiction` : 
    'across all jurisdictions';

  const topicContext = filters?.legalTopic ? 
    `in the context of ${filters.legalTopic}` : 
    'across all legal topics';

  const dateContext = filters?.dateRange?.start ? 
    `between ${filters.dateRange.start} and ${filters.dateRange.end}` : 
    'without date restrictions';

  const prompt = `
    As a legal research expert, conduct a comprehensive analysis ${jurisdictionContext} ${topicContext} ${dateContext} on the following query:
    "${query}"

    IMPORTANT: Respond ONLY with a valid JSON object in the following structure:
    {
      "executiveSummary": "Brief overview of findings focusing on ${jurisdictionContext} ${topicContext}",
      "findings": [
        {
          "title": "Main point or case name",
          "source": "Source of information",
          "relevanceScore": number between 0-100,
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

    // Clean and parse JSON response
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;

    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error("No valid JSON found in response");
    }

    const jsonStr = text.substring(jsonStart, jsonEnd)
      .replace(/[\u0000-\u001F]+/g, '')
      .replace(/\\[rnt]/g, '');

    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error(`Invalid response format from AI model: ${error.message}`);
  }
}