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

// Helper function to sanitize text for JSON
function sanitizeForJson(text: string): string {
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .replace(/\\(?!["\\/bfnrt])/g, '\\\\') // Escape backslashes
    .replace(/"/g, '\\"') // Escape quotes
    .trim();
}

export class ContractAnalysisService {
  // Split contract into clauses using semantic analysis
  private async splitIntoSemanticClauses(text: string): Promise<Array<{text: string, startIndex: number, endIndex: number}>> {
    try {
      console.log('Starting clause splitting...');

      const sanitizedText = sanitizeForJson(text);
      const prompt = `Split this contract into individual clauses. For each clause, return a JSON object with the clause text and its start/end indices. Format the output as a valid JSON array of objects with the exact keys: "text", "startIndex", "endIndex". Example format: [{"text": "clause text", "startIndex": 0, "endIndex": 100}]

Contract to split:
${sanitizedText}`;

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        system: "You are a legal document analyzer. Split contracts into semantic clauses. Always return valid JSON arrays."
      });

      if (!response.content || response.content.length === 0) {
        throw new Error('Empty response from Anthropic API');
      }

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected content type in response');
      }

      // Parse and validate the response
      let result;
      try {
        result = JSON.parse(content.text);
        if (!Array.isArray(result)) {
          throw new Error('Response is not an array');
        }
      } catch (parseError) {
        console.error('JSON Parse error:', parseError);
        console.error('Raw response:', content.text);
        throw new Error('Invalid JSON response from API');
      }

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

      const sanitizedText = sanitizeForJson(clause.text);
      const prompt = `Analyze this contract clause and output a JSON object with exactly these fields:
{
  "clauseId": "string",
  "originalText": "string",
  "startIndex": number,
  "endIndex": number,
  "riskScore": number (0-10),
  "suggestedText": "string",
  "explanation": "string",
  "version": 1,
  "riskLevel": "HIGH" or "MEDIUM" or "LOW",
  "category": "LEGAL" or "COMPLIANCE" or "COMMERCIAL" or "TECHNICAL",
  "impact": "string",
  "confidence": number (0-1)
}

Clause to analyze: ${sanitizedText}`;

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        system: "You are a legal contract analysis expert. Always return valid JSON objects with the exact schema specified."
      });

      if (!response.content || response.content.length === 0) {
        throw new Error('Empty response from Anthropic API');
      }

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected content type in response');
      }

      // Parse and validate the response
      let result;
      try {
        result = JSON.parse(content.text);
      } catch (parseError) {
        console.error('JSON Parse error:', parseError);
        console.error('Raw response:', content.text);
        throw new Error('Invalid JSON response from API');
      }

      // Validate against schema and merge with clause info
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