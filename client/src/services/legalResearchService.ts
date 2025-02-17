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

    const promptTemplate = `Analyze the following legal document and provide a comprehensive analysis. Include:
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

    console.log('Sending request to OpenAI...'); // Debug log

    const completion = await openai.chat.completions.create({
      model: "gpt-4-0125-preview",
      messages: [
        { 
          role: "system", 
          content: "You are a legal research expert specializing in regulatory compliance, contract law, and corporate governance." 
        },
        { 
          role: "user", 
          content: promptTemplate 
        }
      ],
      response_format: { type: "json_object" }
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
    throw new Error('Failed to analyze legal document');
  }
}