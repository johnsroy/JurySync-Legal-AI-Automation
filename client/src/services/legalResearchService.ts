import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface LegalAnalysis {
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

export async function analyzeLegalDocument(content: string): Promise<LegalAnalysis> {
  try {
    console.log('Starting legal document analysis...'); // Debug log

    if (!content || content.trim().length === 0) {
      throw new Error('No content provided for analysis');
    }

    const promptTemplate = `Analyze the following legal document content in detail. Provide a comprehensive analysis that includes:

    1. An executive summary of the key findings
    2. Key legal principles and their implications
    3. Relevant case law and precedents that apply
    4. Citations and references to support the analysis
    5. Actionable recommendations

    Document Content:
    ${content.slice(0, 8000)} // Limit content length to avoid token limits

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

    console.log('Sending request to OpenAI...'); // Debug log

    const completion = await openai.chat.completions.create({
      model: "gpt-4-0125-preview",
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

    console.log('Received response from OpenAI'); // Debug log

    const responseContent = completion.choices[0].message.content;
    if (!responseContent) {
      throw new Error('No analysis generated from AI model');
    }

    console.log('Parsing response...'); // Debug log
    const parsedResponse = JSON.parse(responseContent) as LegalAnalysis;
    console.log('Analysis complete:', parsedResponse); // Debug log

    return parsedResponse;
  } catch (error) {
    console.error('Legal analysis error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to analyze legal document');
  }
}