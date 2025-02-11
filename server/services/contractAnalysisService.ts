import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Schema for clause analysis response
const clauseAnalysisSchema = z.object({
  clauseId: z.string(),
  originalText: z.string(),
  startIndex: z.number(),
  endIndex: z.number(),
  riskScore: z.number().min(0).max(10),
  suggestedText: z.string(),
  explanation: z.string(),
  version: z.number().default(1),
  riskLevel: z.enum(["HIGH", "MEDIUM", "LOW"]),
  category: z.enum(["LEGAL", "COMPLIANCE", "COMMERCIAL", "TECHNICAL"]),
  impact: z.string(),
  confidence: z.number().min(0).max(1)
});

export type ClauseAnalysisResult = z.infer<typeof clauseAnalysisSchema>;

export class ContractAnalysisService {
  // Split contract into clauses using semantic analysis
  private async splitIntoSemanticClauses(text: string): Promise<Array<{text: string, startIndex: number, endIndex: number}>> {
    try {
      console.log('Starting clause splitting...');

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Split this contract into individual clauses. For each clause, return a JSON object with the clause text and its start/end indices. Format as array of {text, startIndex, endIndex}:\n\n${text}`
        }],
        system: "You are a legal document analyzer. Split contracts into semantic clauses, maintaining proper legal context."
      });

      if (!response.content || response.content.length === 0) {
        throw new Error('Empty response from Anthropic API');
      }

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected content type in response');
      }

      const result = JSON.parse(content.text);
      console.log('Successfully split contract into clauses');
      return result;
    } catch (error) {
      console.error('Error in splitIntoSemanticClauses:', error);
      throw new Error('Failed to split contract into clauses: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  // Analyze a single clause
  private async analyzeClause(
    clause: { text: string; startIndex: number; endIndex: number },
    index: number
  ): Promise<ClauseAnalysisResult> {
    try {
      console.log(`Analyzing clause ${index + 1}...`);

      const prompt = `Analyze this contract clause and provide:
1. Risk assessment (score 0-10)
2. Suggested improvements
3. Explanation of issues
4. Risk level (HIGH/MEDIUM/LOW)
5. Category (LEGAL/COMPLIANCE/COMMERCIAL/TECHNICAL)
6. Business impact
7. Confidence score (0-1)

Respond in JSON format matching this schema:
{
  "clauseId": string,
  "originalText": string,
  "startIndex": number,
  "endIndex": number,
  "riskScore": number,
  "suggestedText": string,
  "explanation": string,
  "version": number,
  "riskLevel": "HIGH" | "MEDIUM" | "LOW",
  "category": "LEGAL" | "COMPLIANCE" | "COMMERCIAL" | "TECHNICAL",
  "impact": string,
  "confidence": number
}

Clause to analyze: ${clause.text}`;

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        system: "You are a legal contract analysis expert. Analyze contract clauses for risks and suggest improvements."
      });

      if (!response.content || response.content.length === 0) {
        throw new Error('Empty response from Anthropic API');
      }

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected content type in response');
      }

      const result = JSON.parse(content.text);
      return clauseAnalysisSchema.parse({
        ...result,
        clauseId: `clause-${index + 1}`,
        startIndex: clause.startIndex,
        endIndex: clause.endIndex
      });
    } catch (error) {
      console.error(`Error analyzing clause ${index + 1}:`, error);
      throw new Error('Failed to analyze clause: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  // Analyze entire contract
  async analyzeContract(contractText: string): Promise<ClauseAnalysisResult[]> {
    try {
      console.log('Starting contract analysis...');

      // Split into clauses
      const clauses = await this.splitIntoSemanticClauses(contractText);
      console.log(`Split contract into ${clauses.length} clauses`);

      // Analyze each clause
      const analysisPromises = clauses.map((clause, index) => 
        this.analyzeClause(clause, index)
      );

      const results = await Promise.all(analysisPromises);
      console.log('Contract analysis complete');

      return results;
    } catch (error) {
      console.error('Contract analysis failed:', error);
      throw error;
    }
  }
}

export const contractAnalysisService = new ContractAnalysisService();