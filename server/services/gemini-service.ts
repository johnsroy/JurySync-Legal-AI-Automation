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
  relevantDocs?: any[];
}

export async function generateDeepResearch(query: string, filters?: ResearchFilters) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    console.log('Starting Gemini research with:', { query, filters });

    const model = await genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
      generationConfig: {
        temperature: 0.7,
        topP: 1,
        topK: 40,
        maxOutputTokens: 2048,
      },
    });

    const prompt = `
      You are a legal research expert. Analyze the following query and provide a comprehensive response.
      Query: "${query}"

      Context:
      - Jurisdiction: ${filters?.jurisdiction || 'All jurisdictions'}
      - Legal Topic: ${filters?.legalTopic || 'All legal topics'}
      - Date Range: ${filters?.dateRange?.start ? `${filters.dateRange.start} to ${filters.dateRange.end}` : 'No specific range'}

      ${filters?.relevantDocs?.length ? `
      Relevant documents to consider:
      ${filters.relevantDocs.map((doc, i) => `${i + 1}. ${doc.title} (${doc.jurisdiction}, ${doc.legalTopic}): ${doc.content.substring(0, 200)}...`).join('\n')}
      ` : ''}

      IMPORTANT: Respond with ONLY a valid JSON object using this EXACT structure. Do not include any other text or formatting:

      {
        "executiveSummary": "Brief overview of findings",
        "findings": [
          {
            "title": "Finding title",
            "source": "Source of information",
            "relevanceScore": 95,
            "summary": "Detailed explanation",
            "citations": ["Citation 1", "Citation 2"]
          }
        ],
        "recommendations": [
          "Recommendation 1",
          "Recommendation 2"
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      // Extract only the JSON part from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);

      // Validate response structure
      if (!parsedResponse.executiveSummary || !Array.isArray(parsedResponse.findings)) {
        throw new Error("Invalid response structure from AI");
      }

      // Ensure findings have all required fields
      parsedResponse.findings = parsedResponse.findings.map(finding => ({
        title: finding.title || "Untitled Finding",
        source: finding.source || "Not specified",
        relevanceScore: finding.relevanceScore || 80,
        summary: finding.summary || "No summary provided",
        citations: Array.isArray(finding.citations) ? finding.citations : []
      }));

      // Ensure recommendations is an array
      if (!Array.isArray(parsedResponse.recommendations)) {
        parsedResponse.recommendations = [];
      }

      console.log('Successfully parsed Gemini response');
      return parsedResponse;
    } catch (error: any) {
      console.error('JSON parse error:', error);
      console.error('Raw response:', text);
      throw new Error(`Invalid AI response format: ${error?.message || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.error("Gemini service error:", error);
    throw new Error(`Research failed: ${error?.message || 'Unknown error'}`);
  }
}