import Anthropic from '@anthropic-ai/sdk';
import { z } from "zod";

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_CHUNK_SIZE = 12000; // Tokens per chunk
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

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

function chunkDocument(content: string): string[] {
  const chunks: string[] = [];
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > MAX_CHUNK_SIZE) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      // If a single paragraph is too large, split it into sentences
      if (paragraph.length > MAX_CHUNK_SIZE) {
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > MAX_CHUNK_SIZE) {
            chunks.push(currentChunk.trim());
            currentChunk = sentence;
          } else {
            currentChunk += ' ' + sentence;
          }
        }
      } else {
        currentChunk = paragraph;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function analyzeChunk(chunk: string, documentType: string, chunkIndex: number): Promise<ComplianceResult> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const prompt = `You are a legal compliance expert. Analyze the following ${documentType} document chunk (${chunkIndex + 1}) for compliance issues, risks, and regulatory concerns:

${chunk}

Focus on:
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
}`;

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }]
      });

      const analysisText = response.content[0].text;
      if (!analysisText) {
        throw new Error("Empty response from Anthropic API");
      }

      try {
        const result = JSON.parse(analysisText);
        result.lastChecked = new Date().toISOString();
        return complianceResultSchema.parse(result);
      } catch (error: any) {
        console.error("Failed to parse Anthropic response:", analysisText);
        throw new Error(`Invalid response format: ${error.message}`);
      }
    } catch (error: any) {
      if (attempt === MAX_RETRIES - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt)));
    }
  }
  throw new Error("Maximum retries exceeded");
}

export async function scanDocument(content: string, documentType: string): Promise<ComplianceResult> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Anthropic API key not configured");
    }

    console.log(`[ComplianceMonitor] Scanning document of type: ${documentType}`);
    const chunks = chunkDocument(content);
    console.log(`[ComplianceMonitor] Document split into ${chunks.length} chunks`);

    const chunkResults: ComplianceResult[] = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[ComplianceMonitor] Analyzing chunk ${i + 1}/${chunks.length}`);
      const result = await analyzeChunk(chunks[i], documentType, i);
      chunkResults.push(result);
    }

    // Aggregate results
    const aggregatedResult: ComplianceResult = {
      riskLevel: "LOW",
      score: 0,
      issues: [],
      summary: "",
      lastChecked: new Date().toISOString()
    };

    // Combine all issues
    aggregatedResult.issues = chunkResults.flatMap(r => r.issues);

    // Calculate average score
    aggregatedResult.score = Math.round(
      chunkResults.reduce((sum, r) => sum + r.score, 0) / chunkResults.length
    );

    // Determine overall risk level
    const riskLevels = { HIGH: 2, MEDIUM: 1, LOW: 0 };
    const avgRiskLevel = chunkResults.reduce((sum, r) => sum + riskLevels[r.riskLevel], 0) / chunkResults.length;
    aggregatedResult.riskLevel = avgRiskLevel > 1.5 ? "HIGH" : avgRiskLevel > 0.5 ? "MEDIUM" : "LOW";

    // Combine summaries
    aggregatedResult.summary = chunkResults
      .map((r, i) => `Chunk ${i + 1}: ${r.summary}`)
      .join('\n');

    console.log(`[ComplianceMonitor] Analysis complete with risk level: ${aggregatedResult.riskLevel}`);
    return aggregatedResult;
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