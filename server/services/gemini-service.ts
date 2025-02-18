import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../db";
import { legalResearchReports, type LegalDocument } from "@shared/schema";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface ResearchResponse {
  summary: string;
  documents: {
    title: string;
    source: string;
    citation?: string;
    relevance: number;
    summary: string;
    citations: string[];
    urls?: string[];
  }[];
  analysis: {
    legalPrinciples: string[];
    keyPrecedents: {
      case: string;
      relevance: string;
      impact: string;
    }[];
    recommendations: string[];
  };
}

export async function generateDeepResearch(query: string, relevantDocs: LegalDocument[]): Promise<ResearchResponse> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    console.log('Starting Gemini research with:', { query, docsCount: relevantDocs.length });

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
      As a legal research expert, analyze this query and relevant documents to provide a comprehensive research response.
      Query: "${query}"

      Relevant documents to consider:
      ${relevantDocs.map((doc, i) => `${i + 1}. ${doc.title} (${doc.jurisdiction}, ${doc.legalTopic}): ${doc.content.substring(0, 200)}...`).join('\n')}

      Respond with ONLY a valid JSON object using this EXACT structure:
      {
        "summary": "Brief overview of findings",
        "documents": [
          {
            "title": "Document title",
            "source": "Source name or citation",
            "relevance": 0.95,
            "summary": "Document-specific summary",
            "citations": ["Relevant citations"],
            "urls": ["Optional related URLs"]
          }
        ],
        "analysis": {
          "legalPrinciples": ["Key legal principles identified"],
          "keyPrecedents": [
            {
              "case": "Case name and citation",
              "relevance": "Why this case matters",
              "impact": "How it affects the query"
            }
          ],
          "recommendations": ["Actionable recommendations"]
        }
      }
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    try {
      // Extract only the JSON part from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }

      const parsedResponse = JSON.parse(jsonMatch[0]) as ResearchResponse;

      // Validate response structure
      if (!parsedResponse.summary || !parsedResponse.documents || !parsedResponse.analysis) {
        throw new Error("Invalid response structure from AI");
      }

      // Ensure all required fields exist with proper types
      const validatedResponse: ResearchResponse = {
        summary: parsedResponse.summary,
        documents: parsedResponse.documents.map(doc => ({
          title: doc.title || "Untitled Document",
          source: doc.source || "Unknown Source",
          relevance: typeof doc.relevance === 'number' ? doc.relevance : 0.5,
          summary: doc.summary || "No summary provided",
          citations: Array.isArray(doc.citations) ? doc.citations : [],
          urls: Array.isArray(doc.urls) ? doc.urls : []
        })),
        analysis: {
          legalPrinciples: Array.isArray(parsedResponse.analysis.legalPrinciples) 
            ? parsedResponse.analysis.legalPrinciples 
            : [],
          keyPrecedents: Array.isArray(parsedResponse.analysis.keyPrecedents) 
            ? parsedResponse.analysis.keyPrecedents.map(precedent => ({
                case: precedent.case || "Untitled Case",
                relevance: precedent.relevance || "Not specified",
                impact: precedent.impact || "Not specified"
              }))
            : [],
          recommendations: Array.isArray(parsedResponse.analysis.recommendations)
            ? parsedResponse.analysis.recommendations
            : []
        }
      };

      console.log('Successfully generated research response');
      return validatedResponse;

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