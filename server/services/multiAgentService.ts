import { openai } from "../openai";
import { anthropic } from "../anthropic";
import { type WorkflowResult } from "@shared/types";

interface DraftGenerationResult {
  content: string;
  suggestions: string[];
  metadata: {
    documentType: string;
    keyPoints: string[];
  };
}

interface ComplianceResult {
  status: 'Compliant' | 'Non-Compliant' | 'Needs Review';
  score: number;
  findings: string[];
  risks: Array<{
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
  }>;
}

interface LegalResearchResult {
  relatedDocuments: Array<{
    title: string;
    url: string;
    relevanceScore: number;
    summary: string;
  }>;
  legalPrecedents: string[];
  recommendations: string[];
}

export class MultiAgentService {
  async generateDraft(content: string): Promise<DraftGenerationResult> {
    const systemPrompt = `You are a legal document drafting expert. Analyze the provided document and enhance it with proper legal formatting, structure, and clarity. Provide output in this exact JSON format:
{
  "enhancedContent": "string - the improved document content",
  "suggestions": ["array of string suggestions for improvements"],
  "metadata": {
    "documentType": "string - identified document type",
    "keyPoints": ["array of key points from the document"]
  }
}`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 4000,
        temperature: 0,
        system: systemPrompt,
        messages: [
          { 
            role: "user", 
            content: `Analyze and enhance this document:\n${content}`
          }
        ]
      });

      const responseContent = response.content[0].text;
      const result = JSON.parse(responseContent);

      return {
        content: result.enhancedContent,
        suggestions: result.suggestions,
        metadata: result.metadata
      };
    } catch (error) {
      console.error("Draft generation error:", error);
      throw error;
    }
  }

  async performComplianceCheck(content: string): Promise<ComplianceResult> {
    const prompt = `You are a legal compliance expert. Perform a detailed compliance analysis of the provided document and output in this exact JSON format:
{
  "status": "string - Compliant, Non-Compliant, or Needs Review",
  "score": "number - compliance score between 0 and 100",
  "findings": ["array of string findings"],
  "risks": [
    {
      "severity": "string - HIGH, MEDIUM, or LOW",
      "description": "string - detailed description of the risk"
    }
  ]
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: content }
        ],
        response_format: { type: "json_object" },
        temperature: 0
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");
      return {
        status: result.status,
        score: result.score,
        findings: result.findings,
        risks: result.risks
      };
    } catch (error) {
      console.error("Compliance check error:", error);
      throw error;
    }
  }

  async conductLegalResearch(content: string): Promise<LegalResearchResult> {
    const systemPrompt = `You are a legal research expert. Analyze the document and provide related legal documents, precedents, and recommendations. Output in this exact JSON format:
{
  "relatedDocuments": [
    {
      "title": "string - document title",
      "url": "string - URL to the document",
      "relevanceScore": "number between 0 and 1",
      "summary": "string - brief summary"
    }
  ],
  "legalPrecedents": ["array of relevant legal precedents"],
  "recommendations": ["array of recommendations"]
}`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 2000,
        temperature: 0,
        system: systemPrompt,
        messages: [
          { 
            role: "user", 
            content: `Conduct legal research for this document:\n${content}`
          }
        ]
      });

      const responseContent = response.content[0].text;
      const result = JSON.parse(responseContent);
      return {
        relatedDocuments: result.relatedDocuments,
        legalPrecedents: result.legalPrecedents,
        recommendations: result.recommendations
      };
    } catch (error) {
      console.error("Legal research error:", error);
      throw error;
    }
  }

  async generateFinalAudit(content: string, workflowResults: WorkflowResult[]): Promise<any> {
    const auditPrompt = `You are a legal auditing expert. Review the document and workflow results to generate a comprehensive audit report. Output in this exact JSON format:
{
  "summary": "string - executive summary",
  "compliance": {
    "status": "string - overall compliance status",
    "score": "number between 0 and 100",
    "findings": ["array of findings"]
  },
  "risks": [
    {
      "category": "string - risk category",
      "severity": "string - HIGH, MEDIUM, or LOW",
      "description": "string - risk description",
      "mitigation": "string - mitigation steps"
    }
  ],
  "recommendations": ["array of recommendations"],
  "timeline": {
    "reviewed": "string - ISO date",
    "nextReview": "string - ISO date",
    "expiryDate": "string - ISO date if applicable"
  }
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: auditPrompt },
          { 
            role: "user", 
            content: JSON.stringify({
              document: content,
              workflowResults: workflowResults
            })
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");
      return result;
    } catch (error) {
      console.error("Final audit error:", error);
      throw error;
    }
  }
}

export const multiAgentService = new MultiAgentService();