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
    console.log('Starting Gemini research with:', { query, filters });

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

      IMPORTANT: Your response must be a valid JSON object with this exact structure:
      {
        "executiveSummary": "Brief overview of findings",
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
          "Action-oriented recommendations"
        ]
      }
    `;

    console.log('Sending prompt to Gemini:', prompt);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('Raw Gemini response:', text);

    // Clean and parse JSON response
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;

    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error("Invalid JSON structure in Gemini response");
    }

    const jsonStr = text.substring(jsonStart, jsonEnd)
      .replace(/[\u0000-\u001F]+/g, '')
      .replace(/\\[rnt]/g, '');

    try {
      const parsedResponse = JSON.parse(jsonStr);
      console.log('Successfully parsed Gemini response');
      return parsedResponse;
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.log('Failed JSON string:', jsonStr);
      throw new Error(`Failed to parse Gemini response: ${parseError.message}`);
    }
  } catch (error) {
    console.error("Gemini service error:", error);

    // Return a fallback response for failed queries
    return {
      executiveSummary: "Unable to process query at this time. Here's a sample research result:",
      findings: [
        {
          title: "Sample Legal Analysis",
          source: "Example Database",
          relevanceScore: 85,
          summary: "This is an example of how research results will appear. Please try your query again or contact support if the issue persists.",
          citations: ["Example v. Case (2024)"]
        }
      ],
      recommendations: [
        "Please try refining your search terms",
        "Consider using more specific legal terminology",
        "Contact support if you continue experiencing issues"
      ]
    };
  }
}