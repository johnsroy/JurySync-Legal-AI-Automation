import { z } from "zod";
import { DocumentMetadata, WorkflowResult } from "@shared/types";
import { openai } from "../openai";
import { anthropic } from "../anthropic";

export class DocumentAnalyticsService {
  private async analyzeWithOpenAI(content: string) {
    const prompt = `Analyze the following document and provide:
1. Document Type (e.g., SOC Report, Contract, Legal Brief)
2. Industry Classification
3. Compliance Status
4. Risk Assessment

Document content:
${content.substring(0, 3000)}

Return your analysis in JSON format with the following structure:
{
  "documentType": "string",
  "industry": "string",
  "complianceStatus": {
    "status": "PASSED" | "FAILED" | "PENDING",
    "details": "string"
  }
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are a document analysis expert specializing in legal and compliance documents. Return only valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(completion.choices[0].message.content);
      return result;
    } catch (error) {
      console.error("OpenAI analysis error:", error);
      throw new Error("Failed to analyze document with OpenAI");
    }
  }

  private async analyzeWithAnthropic(content: string) {
    const prompt = `Analyze this document and classify it. Return only a JSON object with this exact structure:
{
  "documentType": "string",
  "industry": "string",
  "complianceStatus": {
    "status": "PASSED" | "FAILED" | "PENDING",
    "details": "string"
  }
}

Document content:
${content.substring(0, 3000)}`;

    try {
      const message = await anthropic.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 1024,
        temperature: 0.1,
        system: "You are a document analysis expert. Return only valid JSON matching the specified structure.",
        messages: [{ role: "user", content: prompt }]
      });

      return JSON.parse(message.content[0].text);
    } catch (error) {
      console.error("Anthropic analysis error:", error);
      throw new Error("Failed to analyze document with Anthropic");
    }
  }

  async processWorkflowResults(workflowResults: WorkflowResult[]): Promise<DocumentMetadata> {
    try {
      const documentContent = workflowResults
        .find(result => result.stageType === 'classification')
        ?.content || '';

      if (!documentContent) {
        throw new Error("No document content found in workflow results");
      }

      let openaiAnalysis;
      let anthropicAnalysis;

      try {
        [openaiAnalysis, anthropicAnalysis] = await Promise.all([
          this.analyzeWithOpenAI(documentContent),
          this.analyzeWithAnthropic(documentContent)
        ]);
      } catch (error) {
        console.error("AI analysis error:", error);
        throw new Error("Failed to analyze document content");
      }

      const complianceResult = workflowResults.find(result => result.stageType === 'compliance');

      const metadata: DocumentMetadata = {
        documentType: openaiAnalysis.documentType || anthropicAnalysis.documentType || "Unknown",
        industry: openaiAnalysis.industry || anthropicAnalysis.industry || "Unknown",
        complianceStatus: openaiAnalysis.complianceStatus?.status || anthropicAnalysis.complianceStatus?.status || "Unknown",
        analysisTimestamp: new Date().toISOString(),
        confidence: 0.95,
        classifications: [{
          category: "LEGAL",
          subCategory: openaiAnalysis.documentType || anthropicAnalysis.documentType || "Unknown",
          tags: [openaiAnalysis.industry || anthropicAnalysis.industry || "Unknown"]
        }],
        riskScore: complianceResult?.riskScore || 0
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
      await fetch(`/api/vault/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata }),
      });
    } catch (error) {
      console.error("Error updating vault document:", error);
      throw error;
    }
  }
}

export const documentAnalyticsService = new DocumentAnalyticsService();