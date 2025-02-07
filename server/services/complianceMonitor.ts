import { openai } from "../openai";
import { z } from "zod";

export const complianceResultSchema = z.object({
  riskLevel: z.enum(["HIGH", "MEDIUM", "LOW"]),
  score: z.number().min(0).max(100),
  issues: z.array(z.object({
    clause: z.string(),
    description: z.string(),
    severity: z.enum(["CRITICAL", "WARNING", "INFO"]),
    recommendation: z.string(),
    reference: z.string().optional()
  })),
  summary: z.string(),
  lastChecked: z.string()
});

export type ComplianceResult = z.infer<typeof complianceResultSchema>;

export async function scanDocument(content: string, documentType: string): Promise<ComplianceResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a legal compliance expert. Analyze the document for compliance issues, risks, and regulatory concerns. Focus on:
1. Non-compliant clauses
2. Missing required sections
3. Regulatory violations
4. Best practice deviations

Return a JSON response with:
- riskLevel: Overall risk assessment ("HIGH", "MEDIUM", "LOW")
- score: Compliance score (0-100)
- issues: Array of identified issues
- summary: Brief analysis summary
- lastChecked: Current timestamp`
        },
        {
          role: "user",
          content: `Document Type: ${documentType}\n\nContent:\n${content}`
        }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    result.lastChecked = new Date().toISOString();
    
    return complianceResultSchema.parse(result);
  } catch (error: any) {
    console.error("Compliance scanning error:", error);
    throw new Error(`Failed to scan document: ${error.message}`);
  }
}

export async function monitorDocuments(documents: Array<{ id: string; content: string; type: string }>) {
  const results: Record<string, ComplianceResult> = {};
  
  for (const doc of documents) {
    try {
      results[doc.id] = await scanDocument(doc.content, doc.type);
    } catch (error) {
      console.error(`Failed to scan document ${doc.id}:`, error);
    }
  }
  
  return results;
}
