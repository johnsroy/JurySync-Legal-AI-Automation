import { z } from "zod";
import { AnalysisResult, DocumentMetadata, WorkflowResult } from "@shared/types";
import { openai } from "../openai";
import { anthropic } from "../anthropic";

const documentClassificationSchema = z.object({
  documentType: z.string(),
  industry: z.string(),
  complianceStatus: z.object({
    status: z.enum(['PASSED', 'FAILED', 'PENDING']),
    details: z.string(),
    lastChecked: z.string()
  }),
  confidence: z.number(),
  classification: z.object({
    category: z.string(),
    subCategory: z.string(),
    tags: z.array(z.string()),
  }),
});

export class DocumentAnalyticsService {
  private async analyzeWithOpenAI(content: string) {
    const prompt = `Analyze the following document and provide:
1. Document Type (e.g., Contract, Report, Legal Brief)
2. Industry Classification
3. Compliance Status and Details

Document content:
${content.substring(0, 3000)}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a document analysis expert. Analyze documents and provide structured metadata about their type, industry, and compliance status."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    return JSON.parse(completion.choices[0].message.content);
  }

  private async analyzeWithAnthropic(content: string) {
    const prompt = `Analyze this document and provide structured information about its type, industry, and compliance status. Format your response as JSON.

Document content:
${content.substring(0, 3000)}`;

    const message = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1024,
      temperature: 0.2,
      system: "You are a document analysis expert. Analyze documents and provide structured metadata about their type, industry, and compliance status.",
      messages: [{ role: "user", content: prompt }]
    });

    return JSON.parse(message.content[0].text);
  }

  async processWorkflowResults(workflowResults: WorkflowResult[]): Promise<DocumentMetadata> {
    try {
      // Extract document content from workflow results
      const documentContent = workflowResults
        .find(result => result.stageType === 'classification')
        ?.content || '';

      // Get analysis from both models
      const [openaiAnalysis, anthropicAnalysis] = await Promise.all([
        this.analyzeWithOpenAI(documentContent),
        this.analyzeWithAnthropic(documentContent)
      ]);

      // Combine and validate results
      const metadata: DocumentMetadata = {
        documentType: openaiAnalysis.documentType || anthropicAnalysis.documentType,
        industry: openaiAnalysis.industry || anthropicAnalysis.industry,
        complianceStatus: {
          status: openaiAnalysis.complianceStatus?.status || anthropicAnalysis.complianceStatus?.status || 'PENDING',
          details: openaiAnalysis.complianceStatus?.details || anthropicAnalysis.complianceStatus?.details || '',
          lastChecked: new Date().toISOString()
        },
        analysisTimestamp: new Date().toISOString(),
        confidence: Math.max(openaiAnalysis.confidence || 0, anthropicAnalysis.confidence || 0),
        classifications: [
          openaiAnalysis.classification || anthropicAnalysis.classification
        ].filter(Boolean),
        riskScore: workflowResults.find(result => result.stageType === 'compliance')?.riskScore || 0
      };

      console.log('Document analysis results:', metadata);
      return metadata;
    } catch (error) {
      console.error('Error processing workflow results:', error);
      throw error;
    }
  }

  async updateVaultDocument(documentId: string, metadata: DocumentMetadata): Promise<void> {
    try {
      const response = await fetch(`/api/vault/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata }),
      });

      if (!response.ok) {
        throw new Error("Failed to update vault document");
      }
    } catch (error) {
      console.error("Error updating vault document:", error);
      throw error;
    }
  }
}

export const documentAnalyticsService = new DocumentAnalyticsService();