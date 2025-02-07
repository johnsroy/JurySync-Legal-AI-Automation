import { db } from "../db";
import { riskAssessments, complianceIssues, type RiskAssessment } from "@shared/schema";
import OpenAI from "openai";
import { eq } from "drizzle-orm";

const openai = new OpenAI();

export class RiskAssessmentService {
  private async analyzeDocument(content: string): Promise<RiskAssessment[]> {
    try {
      console.log('Starting document analysis...');

      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a legal document risk assessment expert. Analyze the following document and identify potential risks, compliance issues, and legal concerns. Return a JSON object with a 'risks' array containing assessment objects. Each risk assessment should have:
            - score (number 0-100)
            - severity (one of: "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO")
            - category (string)
            - description (string)
            - impact (string)
            - mitigation (string)
            - references (array of strings)
            - context (string)
            - confidence (number 0-100)
            Example:
            {
              "risks": [
                {
                  "score": 85,
                  "severity": "HIGH",
                  "category": "Data Privacy",
                  "description": "Insufficient data protection clauses",
                  "impact": "Potential regulatory non-compliance",
                  "mitigation": "Add GDPR-compliant data protection clauses",
                  "references": ["GDPR Article 28", "Data Protection Act 2018"],
                  "context": "Section 3.2",
                  "confidence": 90
                }
              ]
            }`
          },
          {
            role: "user",
            content: content
          }
        ],
        model: "gpt-4",
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const responseText = completion.choices[0].message.content;
      console.log('Received response:', responseText);

      if (!responseText) {
        throw new Error('Empty response from OpenAI');
      }

      try {
        const parsedResponse = JSON.parse(responseText);
        if (!parsedResponse.risks || !Array.isArray(parsedResponse.risks)) {
          throw new Error('Invalid response format: missing risks array');
        }
        return parsedResponse.risks;
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        throw new Error('Failed to parse AI response');
      }
    } catch (error) {
      console.error("Error analyzing document:", error);
      throw new Error(`Failed to analyze document: ${error.message}`);
    }
  }

  async assessDocument(documentId: number, content: string) {
    try {
      console.log(`Starting risk assessment for document ${documentId}`);

      if (!content || typeof content !== 'string') {
        throw new Error('Invalid document content');
      }

      // Clean the content to remove any DOCTYPE or invalid characters
      const cleanContent = content
        .replace(/<!DOCTYPE[^>]*>/i, '')
        .replace(/[\uFFFD\uFFFE\uFFFF]/g, '');

      // Analyze document content
      const risks = await this.analyzeDocument(cleanContent);

      // Store results
      for (const risk of risks) {
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
            context: risk.context,
            confidence: risk.confidence,
            detectedAt: new Date(),
          })
          .returning();

        // Create corresponding compliance issue
        await db.insert(complianceIssues).values({
          documentId,
          riskAssessmentId: assessment.id,
          clause: risk.context || "Document-wide",
          description: risk.description,
          severity: risk.severity,
          recommendation: risk.mitigation,
          reference: risk.references?.[0],
          status: "OPEN",
        });
      }

      return await this.getDocumentRisks(documentId);
    } catch (error) {
      console.error("Error in risk assessment:", error);
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