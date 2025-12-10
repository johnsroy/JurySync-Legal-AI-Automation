import { OpenAI } from "openai";
import { z } from "zod";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    const systemPrompt = `You are a legal research expert specializing in digital law and content regulations. Analyze the provided query and documents to generate comprehensive legal research findings.

    For natural language queries like "digital content", focus on:
    - Digital rights and intellectual property
    - Content distribution and licensing
    - Online platform regulations
    - Data protection and privacy implications

    Format your response as a JSON object with the following structure:
    {
      "results": [
        {
          "title": "string - descriptive title for the finding",
          "source": "string - authoritative source or precedent",
          "relevance": "number - relevance score from 0-100",
          "summary": "string - detailed analysis and implications",
          "citations": ["string - specific legal citations and references"]
        }
      ],
      "recommendations": ["string - actionable legal recommendations"],
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

            Please provide a comprehensive legal analysis focusing on the query's implications, relevant precedents, and practical recommendations.
          `
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000
    });

    const rawResponse = response.choices[0].message.content;
    if (!rawResponse) {
      throw new Error("Empty response from OpenAI");
    }

    console.log("Raw OpenAI response:", rawResponse);

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

// Document analysis schema
const legalAnalysisResponseSchema = z.object({
  summary: z.string(),
  analysis: z.object({
    legalPrinciples: z.array(z.string()),
    keyPrecedents: z.array(z.object({
      case: z.string(),
      relevance: z.string(),
      impact: z.string()
    })),
    recommendations: z.array(z.string())
  }),
  citations: z.array(z.object({
    source: z.string(),
    reference: z.string(),
    context: z.string()
  }))
});

export type LegalAnalysisResponse = z.infer<typeof legalAnalysisResponseSchema>;

/**
 * Analyzes a legal document and provides comprehensive insights
 * This replaces the client-side OpenAI call for security
 */
export async function analyzeLegalDocumentContent(content: string): Promise<LegalAnalysisResponse> {
  try {
    console.log('Starting legal document analysis...');

    if (!content || content.trim().length === 0) {
      throw new Error('No content provided for analysis');
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    const promptTemplate = `Analyze the following legal document content in detail. Provide a comprehensive analysis that includes:

    1. An executive summary of the key findings
    2. Key legal principles and their implications
    3. Relevant case law and precedents that apply
    4. Citations and references to support the analysis
    5. Actionable recommendations

    Document Content:
    ${content.slice(0, 8000)}

    Format the response as a JSON object with this structure:
    {
      "summary": "executive summary text",
      "analysis": {
        "legalPrinciples": ["principle 1", "principle 2", ...],
        "keyPrecedents": [
          {
            "case": "case name",
            "relevance": "relevance to current document",
            "impact": "potential impact on interpretation"
          }
        ],
        "recommendations": ["recommendation 1", "recommendation 2", ...]
      },
      "citations": [
        {
          "source": "source name",
          "reference": "reference details",
          "context": "how this applies to the current document"
        }
      ]
    }`;

    console.log('Sending request to OpenAI...');

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a legal expert specializing in document analysis, regulatory compliance, and legal research. Provide detailed, professional analysis with actionable insights."
        },
        {
          role: "user",
          content: promptTemplate
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 4000
    });

    const responseContent = completion.choices[0].message.content;
    if (!responseContent) {
      throw new Error('No analysis generated from AI model');
    }

    console.log('Parsing response...');
    const parsedResponse = JSON.parse(responseContent);

    // Validate and return the response
    const validatedResponse = legalAnalysisResponseSchema.parse(parsedResponse);
    console.log('Analysis complete');

    return validatedResponse;
  } catch (error: any) {
    console.error('Legal analysis error:', error);

    if (error instanceof z.ZodError) {
      throw new Error("Invalid response format from AI model");
    }

    if (error.response?.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    throw new Error(error.message || 'Failed to analyze legal document');
  }
}