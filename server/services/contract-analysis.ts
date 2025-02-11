import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { ClauseAnalysis, ClauseRiskLevel } from '@shared/schema';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const MODEL = 'claude-3-5-sonnet-20241022';

const clauseAnalysisSchema = z.object({
  clauses: z.array(z.object({
    id: z.string(),
    originalText: z.string(),
    startIndex: z.number(),
    endIndex: z.number(),
    riskLevel: z.enum(["HIGH", "MEDIUM", "LOW"]),
    riskScore: z.number().min(0).max(1),
    suggestedText: z.string(),
    explanation: z.string(),
    category: z.enum(["LEGAL", "COMPLIANCE", "COMMERCIAL", "TECHNICAL"]),
    impact: z.string(),
    confidence: z.number().min(0).max(1)
  }))
});

export async function analyzeContractClauses(
  contractText: string,
  context?: { industry?: string; jurisdiction?: string }
): Promise<ClauseAnalysis[]> {
  try {
    const prompt = `Analyze the following contract text for potential risks, compliance issues, and technical clarity. For each clause, provide:
1. Risk level (HIGH/MEDIUM/LOW)
2. Risk score (0-1)
3. Suggested improvements
4. Category (LEGAL/COMPLIANCE/COMMERCIAL/TECHNICAL)
5. Impact assessment
6. Confidence score (0-1)

The analysis should:
- Identify clause boundaries and index positions
- Evaluate legal and compliance risks
- Suggest clearer or more protective language
- Assess commercial implications
- Consider technical implementation details

Format your response as a JSON object with the following structure:
{
  "clauses": [
    {
      "id": "unique-string",
      "originalText": "exact clause text",
      "startIndex": number,
      "endIndex": number,
      "riskLevel": "HIGH"|"MEDIUM"|"LOW",
      "riskScore": 0.7,
      "suggestedText": "improved version",
      "explanation": "detailed reasoning",
      "category": "LEGAL"|"COMPLIANCE"|"COMMERCIAL"|"TECHNICAL",
      "impact": "potential impact description",
      "confidence": 0.85
    }
  ]
}

Contract text:
${contractText}

Additional context:
Industry: ${context?.industry || 'Not specified'}
Jurisdiction: ${context?.jurisdiction || 'Not specified'}`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    // Access the content directly from the response
    const messageContent = response.content[0].type === 'text' 
      ? response.content[0].text
      : '';

    const analysis = JSON.parse(messageContent);
    const validatedAnalysis = clauseAnalysisSchema.parse(analysis);

    return validatedAnalysis.clauses;
  } catch (error) {
    console.error('Contract analysis error:', error);
    throw new Error('Failed to analyze contract clauses');
  }
}

export async function getClauseImprovementSuggestions(
  clause: string,
  context?: { industry?: string; jurisdiction?: string; category?: string }
): Promise<{
  suggestions: Array<{
    suggestedText: string;
    confidence: number;
    reasoning: string;
    impact: string;
  }>;
}> {
  try {
    const prompt = `Analyze this contract clause and provide 3 potential improvements. Consider:
- Legal compliance and risk mitigation
- Clarity and readability
- Commercial protections
- Technical precision

For each suggestion, provide:
- Improved text version
- Confidence score (0-1)
- Detailed reasoning
- Potential impact

Clause: "${clause}"

Context:
Industry: ${context?.industry || 'Not specified'}
Jurisdiction: ${context?.jurisdiction || 'Not specified'}
Category: ${context?.category || 'Not specified'}

Format response as JSON:
{
  "suggestions": [
    {
      "suggestedText": "improved version",
      "confidence": 0.85,
      "reasoning": "explanation",
      "impact": "description"
    }
  ]
}`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const messageContent = response.content[0].type === 'text' 
      ? response.content[0].text
      : '';

    return JSON.parse(messageContent);
  } catch (error) {
    console.error('Clause improvement error:', error);
    throw new Error('Failed to generate clause improvements');
  }
}