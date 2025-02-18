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

    // Prompt includes instructions to only return JSON
    const prompt = `
      You are a legal research expert. Analyze the following query and provide a comprehensive response.
      Query: "${query}"

      Context:
      - Jurisdiction: ${filters?.jurisdiction || "All jurisdictions"}
      - Legal Topic: ${filters?.legalTopic || "All legal topics"}
      - Date Range: ${filters?.dateRange?.start ? `${filters.dateRange.start} to ${filters.dateRange.end}` : "No specific range"}
      ${filters?.relevantDocs?.length ? `
      Relevant documents to consider:
      ${filters.relevantDocs.map((doc, i) => `${i + 1}. ${doc.title} (${doc.jurisdiction}, ${doc.legalTopic}): ${doc.content.substring(0, 200)}...`).join("\n")}
      ` : ""}

      Provide ONLY a strictly valid JSON object (no extra formatting):
      {
        "executiveSummary": "string",
        "findings": [
          {
            "title": "string",
            "source": "string",
            "relevance": 85,
            "summary": "string",
            "citations": ["Cite1","Cite2"]
          }
        ],
        "recommendations": ["string"]
      }
    `;

    const result = await model.generateContent(prompt);

    // The generative AI interface
    const response = await result.response;

    const text = response.text();
    console.log("Gemini raw response:", text);

    // Attempt to extract only the JSON part
    // This is somewhat naive, but often works if the AI returns extraneous text
    const jsonMatch = text.match(/\{[\s\S]*\}(\s*|\n*)$/);
    if (!jsonMatch) {
      console.error("No JSON match found in AI response. Possibly got HTML or extraneous text");
      throw new Error("No valid JSON output found");
    }

    const cleanedText = jsonMatch[0];

    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "Raw cleaned text:", cleanedText);
      throw new Error(`Invalid AI response format: ${String(parseErr)}`);
    }

    // Validate structure
    if (!parsedResponse.executiveSummary || !Array.isArray(parsedResponse.findings)) {
      throw new Error("AI response is missing required fields (executiveSummary, findings)");
    }

    console.log("Gemini service successfully parsed JSON");
    return parsedResponse;
  } catch (error: any) {
    console.error("Gemini service error:", error);
    throw new Error(`Research failed: ${error?.message || "Unknown error"}`);
  }
}