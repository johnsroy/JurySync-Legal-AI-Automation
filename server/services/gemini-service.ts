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

    // Process natural language query into structured research query
    const queryAnalysisPrompt = `
      Analyze this legal research query and extract key components:
      "${query}"

      Return a JSON object with:
      {
        "structuredQuery": "reformulated query with legal terminology",
        "legalIssues": ["list of identified legal issues"],
        "keyTerms": ["important legal terms"],
        "suggestedJurisdiction": "most relevant jurisdiction if not specified",
        "suggestedTopic": "most relevant legal topic if not specified"
      }
    `;

    const queryAnalysis = await model.generateContent(queryAnalysisPrompt);
    const analysisResult = JSON.parse(queryAnalysis.response.text());
    console.log("Query analysis:", analysisResult);

    // Main research prompt
    const researchPrompt = `
      You are a legal research expert. Analyze the following query and provide a comprehensive response.

      Original Query: "${query}"
      Structured Query: "${analysisResult.structuredQuery}"
      Legal Issues: ${analysisResult.legalIssues.join(", ")}

      Context:
      - Jurisdiction: ${filters?.jurisdiction || analysisResult.suggestedJurisdiction}
      - Legal Topic: ${filters?.legalTopic || analysisResult.suggestedTopic}
      - Date Range: ${filters?.dateRange?.start ? `${filters.dateRange.start} to ${filters.dateRange.end}` : "No specific range"}

      ${filters?.relevantDocs?.length ? `
      Relevant documents to consider:
      ${filters.relevantDocs.map((doc, i) => `${i + 1}. ${doc.title} (${doc.jurisdiction}, ${doc.legalTopic}): ${doc.content.substring(0, 200)}...`).join("\n")}
      ` : ""}

      Provide research findings in this exact JSON format:
      {
        "executiveSummary": "Comprehensive summary of findings",
        "findings": [
          {
            "title": "Key Finding Title",
            "source": "Source Document or Authority",
            "relevance": "Relevance score (1-100)",
            "summary": "Detailed explanation",
            "citations": ["Relevant case citations", "Statutory references"]
          }
        ],
        "recommendations": [
          "Actionable recommendations based on findings"
        ]
      }
    `;

    const result = await model.generateContent(researchPrompt);
    const response = await result.response;
    const text = response.text();
    console.log("Gemini raw response:", text);

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}(\s*|\n*)$/);
    if (!jsonMatch) {
      console.error("No JSON match found in AI response");
      throw new Error("Invalid response format");
    }

    const parsedResponse = JSON.parse(jsonMatch[0]);

    // Validate response structure
    if (!parsedResponse.executiveSummary || !Array.isArray(parsedResponse.findings)) {
      throw new Error("Invalid response structure");
    }

    console.log("Successfully generated research response");
    return parsedResponse;

  } catch (error: any) {
    console.error("Gemini service error:", error);
    throw new Error(`Research failed: ${error?.message || "Unknown error"}`);
  }
}