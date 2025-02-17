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
    const prompt = `Analyze the following legal document and provide a comprehensive analysis. Include:
1. An executive summary
2. Key legal principles identified
3. Relevant case law and precedents
4. Citations and references
5. Recommendations

Document: ${content}

Please format the response as a JSON object with the following structure:
{
  "summary": "executive summary text",
  "analysis": {
    "legalPrinciples": ["principle 1", "principle 2", ...],
    "keyPrecedents": [
      {
        "case": "case name",
        "relevance": "relevance description",
        "impact": "impact description"
      }
    ],
    "recommendations": ["recommendation 1", "recommendation 2", ...]
  },
  "citations": [
    {
      "source": "source name",
      "reference": "reference details",
      "context": "context description"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { 
          role: "system", 
          content: "You are a legal research expert specializing in regulatory compliance, contract law, and corporate governance." 
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('No analysis generated');
    }

    return JSON.parse(content) as LegalAnalysis;
  } catch (error) {
    console.error('Legal analysis error:', error);
    throw new Error('Failed to analyze legal document');
  }
}