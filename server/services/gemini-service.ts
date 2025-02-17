import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { db } from "../db";
import { legalResearchReports } from "@shared/schema";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateDeepResearch(query: string, jurisdiction: string, legalTopic: string, dateRange: { start?: string; end?: string }) {
  console.log('Starting Gemini deep research:', { query, jurisdiction, legalTopic, dateRange });

  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-pro",
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ],
  });

  const prompt = `
    You are a legal research expert specializing in ${jurisdiction} jurisdiction and ${legalTopic}.
    Conduct a comprehensive analysis with deep research capabilities.

    Query: ${query}
    Date Range: ${dateRange.start ? `${dateRange.start} to ${dateRange.end}` : 'No specific range'}

    Provide a detailed analysis following this EXACT structure (do not deviate from this format):
    {
      "keyFindings": [
        {
          "title": "Finding Title",
          "content": "Detailed explanation",
          "citations": ["Relevant case citations"],
          "urls": ["Links to legal resources"]
        }
      ],
      "recommendations": [
        "Specific actionable recommendations"
      ]
    }

    Include:
    1. Key legal precedents in ${jurisdiction}
    2. Statutory framework for ${legalTopic}
    3. Recent judicial interpretations
    4. Academic commentary
    5. Practical implications

    IMPORTANT: Respond ONLY with a valid JSON object following the exact structure above.
    Do not include any other text or formatting outside the JSON structure.
  `;

  try {
    console.log('Sending request to Gemini...');
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    console.log('Received response from Gemini, attempting to parse...');

    try {
      const parsed = JSON.parse(text);

      // Validate the response structure
      if (!parsed.keyFindings || !Array.isArray(parsed.keyFindings) || !parsed.recommendations) {
        console.error('Invalid response structure:', parsed);
        throw new Error('Response missing required fields');
      }

      // Transform to expected format
      return {
        results: parsed.keyFindings.map(finding => ({
          title: finding.title,
          source: "Gemini Legal Research",
          relevance: 95,
          summary: finding.content,
          citations: finding.citations || [],
          urls: finding.urls || []
        })),
        recommendations: parsed.recommendations
      };
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      console.error("Raw response:", text);
      throw new Error("Invalid JSON in AI model response");
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error("Failed to generate research results");
  }
}