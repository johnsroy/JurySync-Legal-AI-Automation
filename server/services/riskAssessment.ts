import { db } from "../db";
import { riskAssessments, complianceIssues, type RiskAssessment } from "@shared/schema";
import OpenAI from "openai";
import { eq } from "drizzle-orm";

const openai = new OpenAI();

export class RiskAssessmentService {
  private async analyzeDocument(content: string): Promise<RiskAssessment[]> {
    try {
      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a legal document risk assessment expert. Analyze the following document and identify potential risks, compliance issues, and legal concerns. For each issue:
            1. Assign a risk score (0-100)
            2. Determine severity (CRITICAL, HIGH, MEDIUM, LOW, INFO)
            3. Categorize the risk
            4. Provide detailed description
            5. Assess potential impact
            6. Suggest mitigation strategies
            7. Include relevant legal references
            Format as valid JSON array with these fields.`
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

      const response = JSON.parse(completion.choices[0].message.content || "{}");
      return response.risks || [];
    } catch (error) {
      console.error("Error analyzing document:", error);
      throw new Error("Failed to analyze document");
    }
  }

  async assessDocument(documentId: number, content: string) {
    try {
      console.log(`Starting risk assessment for document ${documentId}`);
      
      // Analyze document content
      const risks = await this.analyzeDocument(content);
      
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
