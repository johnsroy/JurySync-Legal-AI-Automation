import { db } from "../db";
import { riskAssessments, complianceIssues, type RiskAssessment } from "@shared/schema";
import OpenAI from "openai";
import { eq } from "drizzle-orm";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI();

export class RiskAssessmentService {
  private async analyzeDocument(content: string): Promise<RiskAssessment[]> {
    try {
      console.log('Starting document risk analysis...');

      const sanitizedContent = content
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/[\uFFFD\uFFFE\uFFFF]/g, '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .trim();

      if (!sanitizedContent) {
        throw new Error('Empty or invalid document content after sanitization');
      }

      console.log('Content sanitized, sending to OpenAI...');

      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "user",
            content: `You are a legal document risk assessment expert. Analyze this document and provide a detailed risk assessment in the following JSON format:
{
  "risks": [
    {
      "score": <number between 0-100>,
      "severity": <"CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO">,
      "category": <string describing risk category>,
      "description": <string describing the risk>,
      "impact": <string describing potential impact>,
      "mitigation": <string describing mitigation steps>,
      "references": <array of relevant legal references>,
      "context": <string indicating where in document>,
      "confidence": <number between 0-100>,
      "riskFactors": {
        "regulatory": <number between 0-100>,
        "contractual": <number between 0-100>,
        "litigation": <number between 0-100>,
        "operational": <number between 0-100>
      },
      "trendIndicator": <"INCREASING" | "STABLE" | "DECREASING">,
      "timeToMitigate": <string estimated time to address the risk>,
      "potentialCost": <string estimated cost range if risk materializes>
    }
  ],
  "overallMetrics": {
    "riskScore": <number between 0-100>,
    "riskTrend": <"INCREASING" | "STABLE" | "DECREASING">,
    "topRiskCategories": <array of most critical risk categories>,
    "complianceScore": <number between 0-100>,
    "recommendedActions": <array of priority actions>
  }
}

Document to analyze:
${sanitizedContent}`
          }
        ],
        model: "gpt-4o",
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const responseText = completion.choices[0].message.content;
      console.log('Received OpenAI response:', responseText);

      if (!responseText) {
        throw new Error('Empty response from OpenAI');
      }

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        console.error('Raw response:', responseText);
        throw new Error('Failed to parse OpenAI response as JSON');
      }

      if (!parsedResponse.risks || !Array.isArray(parsedResponse.risks)) {
        console.error('Invalid response structure:', parsedResponse);
        throw new Error('Invalid response format: missing risks array');
      }

      // Validate and transform the risks with enhanced metrics
      const validatedRisks = parsedResponse.risks.map(risk => {
        if (
          typeof risk.score !== 'number' ||
          !['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].includes(risk.severity) ||
          typeof risk.description !== 'string' ||
          typeof risk.impact !== 'string' ||
          typeof risk.mitigation !== 'string'
        ) {
          console.error('Invalid risk object:', risk);
          throw new Error('Invalid risk object structure');
        }

        // Add the new risk metrics
        return {
          ...risk,
          riskFactors: risk.riskFactors || {
            regulatory: Math.round(risk.score * 0.8),
            contractual: Math.round(risk.score * 0.9),
            litigation: Math.round(risk.score * 0.7),
            operational: Math.round(risk.score * 0.85)
          },
          trendIndicator: risk.trendIndicator || "STABLE",
          timeToMitigate: risk.timeToMitigate || "2-4 weeks",
          potentialCost: risk.potentialCost || "$10,000-$50,000"
        };
      });

      console.log(`Successfully analyzed ${validatedRisks.length} risks with enhanced metrics`);
      return validatedRisks;

    } catch (error: any) {
      console.error("Risk analysis error:", error);
      throw new Error(`Failed to analyze document: ${error.message}`);
    }
  }

  async assessDocument(documentId: number, content: string) {
    try {
      console.log(`Starting enhanced risk assessment for document ${documentId}`);

      if (!content || typeof content !== 'string') {
        throw new Error('Invalid document content');
      }

      // Analyze document content with enhanced metrics
      const risks = await this.analyzeDocument(content);
      console.log(`Retrieved ${risks.length} risks with enhanced metrics for document ${documentId}`);

      // Store results with additional metrics
      for (const risk of risks) {
        console.log(`Processing enhanced risk: ${risk.category} - ${risk.severity}`);

        const [assessment] = await db
          .insert(riskAssessments)
          .values({
            documentId,
            score: risk.score,
            severity: risk.severity,
            category: risk.category,
            description: risk.description,
            impact: risk.impact,
            mitigation: risk.mitigation,
            references: risk.references || [],
            context: risk.context || "Document-wide",
            confidence: risk.confidence || 80,
            detectedAt: new Date().toISOString(),
            riskFactors: risk.riskFactors,
            trendIndicator: risk.trendIndicator,
            timeToMitigate: risk.timeToMitigate,
            potentialCost: risk.potentialCost
          })
          .returning();

        console.log(`Stored enhanced risk assessment with ID: ${assessment.id}`);

        // Create corresponding compliance issue
        await db.insert(complianceIssues).values({
          documentId,
          riskAssessmentId: assessment.id,
          clause: risk.context || "Document-wide",
          description: risk.description,
          severity: risk.severity,
          recommendation: risk.mitigation,
          reference: risk.references?.[0] || null,
          status: "OPEN",
        });

        console.log(`Created compliance issue for enhanced risk assessment ${assessment.id}`);
      }

      return await this.getDocumentRisks(documentId);
    } catch (error: any) {
      console.error("Error in enhanced risk assessment:", error);
      throw error;
    }
  }

  async getDocumentRisks(documentId: number) {
    return await db
      .select()
      .from(riskAssessments)
      .where(eq(riskAssessments.documentId, documentId))
      .orderBy(riskAssessments.score);
  }
}

export const riskAssessmentService = new RiskAssessmentService();