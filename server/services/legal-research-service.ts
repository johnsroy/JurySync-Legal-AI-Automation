import { OpenAI } from "openai";
import { z } from "zod";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.VITE_OPENAI_API_KEY });

// Response schema validation
const legalResearchResponseSchema = z.object({
  results: z.array(z.object({
    title: z.string(),
    source: z.string(),
    relevance: z.number(),
    summary: z.string(),
    citations: z.array(z.string())
  })),
  recommendations: z.array(z.string()),
  timestamp: z.string()
});

export type LegalResearchResponse = z.infer<typeof legalResearchResponseSchema>;

export interface ResearchFilters {
  jurisdiction?: string;
  legalTopic?: string;
  dateRange?: {
    start?: string;
    end?: string;
  };
}

export async function generateLegalResearch(
  query: string, 
  filters: ResearchFilters,
  relevantDocs: any[]
): Promise<LegalResearchResponse> {
  try {
    console.log("Generating legal research for query:", query);
    console.log("With filters:", filters);
    
    const systemPrompt = `You are a legal research expert. Analyze the provided query and documents to generate comprehensive legal research findings.
    Format your response as a JSON object with the following structure:
    {
      "results": [
        {
          "title": "string - title of the finding",
          "source": "string - source document or precedent",
          "relevance": "number - relevance score from 0-100",
          "summary": "string - detailed analysis",
          "citations": ["string - relevant citations"]
        }
      ],
      "recommendations": ["string - actionable recommendations"],
      "timestamp": "string - current ISO timestamp"
    }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `
            Query: ${query}
            
            Jurisdiction: ${filters.jurisdiction || 'Any'}
            Legal Topic: ${filters.legalTopic || 'Any'}
            Date Range: ${filters.dateRange ? `${filters.dateRange.start} to ${filters.dateRange.end}` : 'Any'}
            
            Relevant Documents:
            ${relevantDocs.map(doc => `
              Title: ${doc.title}
              Content: ${doc.content}
              Citation: ${doc.citation || 'N/A'}
            `).join('\n')}
          `
        }
      ],
      response_format: { type: "json_object" }
    });

    const rawResponse = response.choices[0].message.content;
    if (!rawResponse) {
      throw new Error("Empty response from OpenAI");
    }

    const parsedResponse = JSON.parse(rawResponse);
    const validatedResponse = legalResearchResponseSchema.parse({
      ...parsedResponse,
      timestamp: new Date().toISOString()
    });

    console.log("Successfully generated legal research response");
    return validatedResponse;

  } catch (error: any) {
    console.error("Legal research generation error:", error);
    
    // Enhanced error handling with specific error types
    if (error instanceof z.ZodError) {
      throw new Error("Invalid response format from AI model");
    }
    
    if (error.response?.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    throw new Error(error.message || "Failed to generate legal research");
  }
}
