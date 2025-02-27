import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface BiasAnalysis {
  score: number;
  factors: string[];
  recommendations: string[];
  confidence: number;
}

export interface DocumentAnalysis {
  summary: string;
  classification: string;
  keywords: string[];
  entities: string[];
  recommendations: string[];
  confidence: number;
  riskLevel: string;
  industry?: string;
}

export async function analyzeBias(content: string): Promise<BiasAnalysis> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Analyze this text for potential biases and provide a structured analysis in JSON format with the following fields:
        - score (number between 0-1)
        - factors (array of identified bias factors)
        - recommendations (array of mitigation recommendations)
        - confidence (number between 0-1)

        Text to analyze: ${content}`
      }],
    });

    const result = JSON.parse(response.content[0].text);
    return result;
  } catch (error: any) {
    console.error("Bias analysis error:", error);
    throw new Error(`Failed to analyze bias: ${error.message}`);
  }
}

export async function analyzeDocument(content: string): Promise<DocumentAnalysis> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Analyze this document and provide a detailed analysis in JSON format with the following fields:
        - summary (string, concise overview)
        - classification (string, document type)
        - keywords (array of key terms)
        - entities (array of identified entities)
        - recommendations (array of action items)
        - confidence (number between 0-1)
        - riskLevel (string: 'LOW', 'MEDIUM', or 'HIGH')
        - industry (string, optional)

        Document content: ${content}`
      }],
    });

    const result = JSON.parse(response.content[0].text);
    return result;
  } catch (error: any) {
    console.error("Document analysis error:", error);
    throw new Error(`Failed to analyze document: ${error.message}`);
  }
}

export interface JurorProfile {
  demographicInsights: string[];
  potentialBiases: string[];
  recommendedQuestions: string[];
  riskFactors: string[];
}

export async function generateJurorProfile(questionnaire: string): Promise<JurorProfile> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Analyze this juror questionnaire and generate a comprehensive profile in JSON format with:
        - demographicInsights (array of key demographic observations)
        - potentialBiases (array of potential bias factors)
        - recommendedQuestions (array of follow-up questions)
        - riskFactors (array of potential risk factors)

        Questionnaire content: ${questionnaire}`
      }],
    });

    const result = JSON.parse(response.content[0].text);
    return result;
  } catch (error: any) {
    console.error("Profile generation error:", error);
    throw new Error(`Failed to generate juror profile: ${error.message}`);
  }
}