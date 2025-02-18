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
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    console.log('Starting Gemini research with:', { query, filters });

    const model = await genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

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
      Conduct a comprehensive legal analysis ${jurisdictionContext} ${topicContext} ${dateContext} for:
      "${query}"

      Format your response EXACTLY as a JSON object with this structure:
      {
        "executiveSummary": "Brief overview of key findings",
        "findings": [
          {
            "title": "Main point or case name",
            "source": "Source information",
            "relevanceScore": "Number between 0-100",
            "summary": "Detailed explanation",
            "citations": ["Relevant citations"]
          }
        ],
        "recommendations": [
          "Action-oriented recommendations"
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('Raw Gemini response:', text);

    try {
      // Clean and parse JSON
      const jsonStr = text.replace(/[\u0000-\u001F]+/g, '').replace(/\\[rnt]/g, '');
      const parsedResponse = JSON.parse(jsonStr);

      // Validate response structure
      if (!parsedResponse.executiveSummary || !Array.isArray(parsedResponse.findings)) {
        throw new Error("Invalid response structure");
      }

      console.log('Successfully parsed Gemini response');
      return parsedResponse;
    } catch (error: any) {
      console.error('JSON parse error:', error);
      throw new Error(`Failed to parse Gemini response: ${error?.message || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.error("Gemini service error:", error);
    throw new Error(`Research analysis failed: ${error?.message || 'Unknown error'}`);
  }
}