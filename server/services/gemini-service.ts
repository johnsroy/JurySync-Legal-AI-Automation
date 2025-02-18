import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../db";
import { legalResearchReports, LegalDocument } from "@shared/schema";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface ResearchFindings {
  title: string;
  source: string;
  relevanceScore: number;
  summary: string;
  citations: string[];
}

interface ResearchResponse {
  summary: string;
  analysis: {
    legalPrinciples: string[];
    keyPrecedents: {
      case: string;
      relevance: string;
      impact: string;
    }[];
    recommendations: string[];
  };
  citations: {
    source: string;
    reference: string;
    context: string;
  }[];
}

interface ResearchFilters {
  jurisdiction?: string;
  legalTopic?: string;
  dateRange?: {
    start?: string;
    end?: string;
  };
}

export async function generateDeepResearch(query: string, relevantDocs: LegalDocument[]) {
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
      You are a legal research expert. Analyze the following query and provide a comprehensive response based on the provided documents.
      Query: "${query}"

      Relevant documents to consider:
      ${relevantDocs.map((doc, i) => `${i + 1}. ${doc.title} (${doc.jurisdiction}, ${doc.legalTopic}): ${doc.content.substring(0, 200)}...`).join('\n')}

      IMPORTANT: Respond with ONLY a valid JSON object using this EXACT structure. Do not include any other text or formatting:

      {
        "summary": "Brief overview of findings",
        "analysis": {
          "legalPrinciples": ["Principle 1", "Principle 2"],
          "keyPrecedents": [
            {
              "case": "Case name and citation",
              "relevance": "Why this case is relevant",
              "impact": "How this case impacts the query"
            }
          ],
          "recommendations": ["Recommendation 1", "Recommendation 2"]
        },
        "citations": [
          {
            "source": "Source name",
            "reference": "Specific reference or citation",
            "context": "How this source supports the analysis"
          }
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
      if (!parsedResponse.summary || !parsedResponse.analysis) {
        throw new Error("Invalid response structure from AI");
      }

      // Ensure analysis has all required fields with proper types
      const validatedResponse = {
        summary: parsedResponse.summary || "",
        analysis: {
          legalPrinciples: Array.isArray(parsedResponse.analysis.legalPrinciples) 
            ? parsedResponse.analysis.legalPrinciples 
            : [],
          keyPrecedents: Array.isArray(parsedResponse.analysis.keyPrecedents) 
            ? parsedResponse.analysis.keyPrecedents.map((precedent: any) => ({
                case: precedent.case || "Untitled Case",
                relevance: precedent.relevance || "Not specified",
                impact: precedent.impact || "Not specified"
              }))
            : [],
          recommendations: Array.isArray(parsedResponse.analysis.recommendations) 
            ? parsedResponse.analysis.recommendations 
            : []
        },
        citations: Array.isArray(parsedResponse.citations) 
          ? parsedResponse.citations.map((citation: any) => ({
              source: citation.source || "Unknown Source",
              reference: citation.reference || "No reference provided",
              context: citation.context || "No context provided"
            }))
          : []
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