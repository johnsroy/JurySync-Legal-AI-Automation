import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024. do not change this unless explicitly requested by the user
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface BiasAnalysis {
  score: number;
  factors: string[];
  recommendations: string[];
  confidence: number;
}

export interface JurorProfile {
  demographicInsights: string[];
  potentialBiases: string[];
  recommendedQuestions: string[];
  riskFactors: string[];
}

export async function analyzeBias(content: string): Promise<BiasAnalysis> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
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

    const result = JSON.parse(response.content[0].value);
    return result;
  } catch (error: any) {
    console.error("Bias analysis error:", error);
    throw new Error(`Failed to analyze bias: ${error.message}`);
  }
}

export async function generateJurorProfile(questionnaire: string): Promise<JurorProfile> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
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

    const result = JSON.parse(response.content[0].value);
    return result;
  } catch (error: any) {
    console.error("Profile generation error:", error);
    throw new Error(`Failed to generate juror profile: ${error.message}`);
  }
}