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
      ${filters.relevantDocs.map((doc, i) => `
      ${i + 1}. ${doc.title} (${doc.jurisdiction}, ${doc.legalTopic})
      Citation: ${doc.citation || 'N/A'}
      Summary: ${doc.content.substring(0, 300)}...
      `).join('\n')}
      ` : 'No specific documents provided.'}

      Provide a comprehensive legal analysis including:
      1. Executive summary of findings
      2. Key legal principles identified
      3. Relevant cases and their impact
      4. Specific recommendations

      Format your response as a JSON object with the following structure:
      {
        "executiveSummary": "string - A concise overview of the findings",
        "findings": [
          {
            "title": "string - Key finding or principle",
            "source": "string - Citation or reference",
            "relevance": "number - Score between 0-1",
            "summary": "string - Detailed explanation",
            "citations": ["string - List of relevant case citations"]
          }
        ],
        "recommendations": ["string - List of actionable recommendations"]
      }
    `;

    console.log('Sending prompt to Gemini:', prompt);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('Raw Gemini response:', text);

    // Clean the response text to ensure it's valid JSON
    const cleanedText = text.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, '$1');

    try {
      const parsedResponse = JSON.parse(cleanedText);

      // Validate response structure
      if (!parsedResponse.executiveSummary || !Array.isArray(parsedResponse.findings)) {
        console.error('Invalid response structure:', parsedResponse);
        throw new Error("Invalid response structure from AI");
      }

      // Ensure findings have required fields
      parsedResponse.findings = parsedResponse.findings.map(finding => ({
        title: finding.title || 'Untitled Finding',
        source: finding.source || 'Unknown Source',
        relevance: typeof finding.relevance === 'number' ? finding.relevance : 1.0,
        summary: finding.summary || 'No summary provided',
        citations: Array.isArray(finding.citations) ? finding.citations : []
      }));

      // Ensure recommendations is an array
      if (!Array.isArray(parsedResponse.recommendations)) {
        parsedResponse.recommendations = [];
      }

      console.log('Successfully processed research response');
      return parsedResponse;

    } catch (error: any) {
      console.error('JSON parse error:', error, 'Raw text:', text);
      throw new Error(`Invalid AI response format: ${error?.message || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.error("Gemini service error:", error);
    throw new Error(`Research failed: ${error?.message || 'Unknown error'}`);
  }
}