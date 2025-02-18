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

    console.log("Starting Gemini research with:", { query, filters });

    const model = await genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: {
        temperature: 0.7,
        topP: 1,
        topK: 40,
        maxOutputTokens: 2048,
      },
    });

    // First attempt to understand the query context
    const contextPrompt = `
      You are a legal research expert. For the following query:
      "${query}"

      Provide a JSON response with key analysis points, strictly in this format:
      {
        "queryType": "legal precedent search | regulatory compliance | case law analysis",
        "relevantAreas": ["area1", "area2"],
        "keyTerms": ["term1", "term2"],
        "suggestedScope": {
          "jurisdiction": "suggested jurisdiction",
          "timeframe": "suggested timeframe",
          "topics": ["topic1", "topic2"]
        }
      }
    `;

    console.log("Analyzing query context...");
    const contextAnalysis = await model.generateContent(contextPrompt);
    const contextText = contextAnalysis.response.text();
    console.log("Context analysis response:", contextText);

    let analysisResult;
    try {
      analysisResult = JSON.parse(contextText);
    } catch (parseError) {
      console.error("Failed to parse context analysis:", parseError);
      throw new Error("Failed to analyze query context");
    }

    // Main research generation
    const researchPrompt = `
      Based on the analyzed context, provide comprehensive legal research for:
      Query: "${query}"
      Type: ${analysisResult.queryType}
      Areas: ${analysisResult.relevantAreas.join(", ")}

      Context:
      - Jurisdiction: ${filters?.jurisdiction || analysisResult.suggestedScope.jurisdiction}
      - Legal Topics: ${filters?.legalTopic || analysisResult.suggestedScope.topics.join(", ")}
      ${filters?.dateRange?.start ? `- Date Range: ${filters.dateRange.start} to ${filters.dateRange.end}` : ''}

      ${filters?.relevantDocs?.length ? `
      Relevant documents:
      ${filters.relevantDocs.map((doc, i) => `${i + 1}. ${doc.title} (${doc.jurisdiction}): ${doc.content.substring(0, 200)}...`).join("\n")}
      ` : ''}

      Provide a focused analysis strictly in this JSON format:
      {
        "executiveSummary": "string - comprehensive overview",
        "findings": [
          {
            "title": "string - key finding",
            "source": "string - authoritative source",
            "relevance": number between 1-100,
            "summary": "string - detailed explanation",
            "citations": ["string - relevant citations"]
          }
        ],
        "recommendations": ["string - actionable recommendations"]
      }
    `;

    console.log("Generating research analysis...");
    const result = await model.generateContent(researchPrompt);
    const response = result.response.text();
    console.log("Research generation raw response:", response);

    let parsedResponse;
    try {
      // Clean the response to ensure we only parse the JSON part
      const jsonMatch = response.match(/\{[\s\S]*\}(\s*|\n*)$/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }
      parsedResponse = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse research response:", parseError);
      throw new Error("Failed to parse research results");
    }

    // Validate the response structure
    if (!parsedResponse.executiveSummary || !Array.isArray(parsedResponse.findings)) {
      console.error("Invalid response structure:", parsedResponse);
      throw new Error("Invalid research results structure");
    }

    // Transform response to ensure proper types
    const formattedResponse = {
      ...parsedResponse,
      findings: parsedResponse.findings.map(finding => ({
        ...finding,
        relevance: typeof finding.relevance === 'string' ? 
          parseInt(finding.relevance, 10) : finding.relevance,
        citations: Array.isArray(finding.citations) ? 
          finding.citations : [finding.citations].filter(Boolean)
      }))
    };

    console.log("Successfully generated research response");
    return formattedResponse;

  } catch (error: any) {
    console.error("Gemini service error:", error);
    throw new Error(`Research failed: ${error?.message || "Unknown error"}`);
  }
}