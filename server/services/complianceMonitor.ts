import Anthropic from '@anthropic-ai/sdk';
import { z } from "zod";

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    console.log(`[ComplianceMonitor] Scanning document of type: ${documentType}`);

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1500,
      system: `You are a legal compliance expert. Analyze the given document for compliance issues, risks, and regulatory concerns. Focus on:
1. Non-compliant clauses
2. Missing required sections
3. Regulatory violations
4. Best practice deviations

Output in JSON format with:
{
  "riskLevel": "HIGH" | "MEDIUM" | "LOW",
  "score": number between 0-100,
  "issues": array of {
    "clause": string identifying the problematic section,
    "description": detailed issue description,
    "severity": "CRITICAL" | "WARNING" | "INFO",
    "recommendation": clear action item to resolve the issue,
    "reference": optional regulatory or legal reference
  },
  "summary": concise analysis summary,
  "lastChecked": current timestamp
}`,
      messages: [
        {
          role: "user",
          content: `Document Type: ${documentType}\n\nContent:\n${content}`
        }
      ],
    });

    const analysisText = response.content[0].text;
    const result = JSON.parse(analysisText);
    result.lastChecked = new Date().toISOString();

    console.log(`[ComplianceMonitor] Analysis complete with risk level: ${result.riskLevel}`);
    return complianceResultSchema.parse(result);
  } catch (error: any) {
    console.error("[ComplianceMonitor] Scanning error:", error);
    throw new Error(`Failed to scan document: ${error.message}`);
  }
}

// Store monitoring results in memory (replace with database in production)
const monitoringResults = new Map<string, ComplianceResult>();

export async function startMonitoring(documents: Array<{ id: string; content: string; type: string }>) {
  console.log(`[ComplianceMonitor] Starting compliance monitoring for ${documents.length} documents`);

  for (const doc of documents) {
    try {
      const result = await scanDocument(doc.content, doc.type);
      monitoringResults.set(doc.id, result);
      console.log(`[ComplianceMonitor] Successfully monitored document ${doc.id}`);
    } catch (error) {
      console.error(`[ComplianceMonitor] Failed to monitor document ${doc.id}:`, error);
    }
  }

  return Array.from(monitoringResults.entries()).map(([id, result]) => ({
    documentId: id,
    ...result
  }));
}

export function getMonitoringResults(documentIds?: string[]) {
  if (!documentIds) {
    return Array.from(monitoringResults.entries()).map(([id, result]) => ({
      documentId: id,
      ...result
    }));
  }

  return documentIds
    .map(id => {
      const result = monitoringResults.get(id);
      return result ? { documentId: id, ...result } : null;
    })
    .filter((result): result is (ComplianceResult & { documentId: string }) => result !== null);
}

// Periodic monitoring (in production, this would be a scheduled job)
setInterval(async () => {
  const documents = Array.from(monitoringResults.keys()).map(id => ({
    id,
    content: "Simulated content for continuous monitoring",
    type: "contract"
  }));

  if (documents.length > 0) {
    console.log("[ComplianceMonitor] Running scheduled compliance check...");
    await startMonitoring(documents);
  }
}, 5 * 60 * 1000); // Check every 5 minutes