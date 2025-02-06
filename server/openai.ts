import OpenAI from "openai";
import type { AgentType, DocumentAnalysis } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const MAX_CHUNK_LENGTH = 2000;
const MAX_CONCURRENT_REQUESTS = 3;

// Helper functions remain unchanged
async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function splitIntoChunks(text: string): string[] {
  const sections = text.split(/(?=SECTION|Article|ARTICLE|\d+\.|^\d+\s)/gm);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const section of sections) {
    if ((currentChunk + section).length > MAX_CHUNK_LENGTH) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = section;
    } else {
      currentChunk += section;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

function getSystemPromptForAgent(agentType: AgentType) {
  switch (agentType) {
    case "CONTRACT_AUTOMATION":
      return `You are a specialized legal contract analysis AI. Your tasks include:
1. Identify contract type and structure
2. Extract key contract elements (parties, dates, terms)
3. Analyze obligations and responsibilities
4. Flag potential risks and ambiguities
5. Suggest improvements based on industry standards
6. Provide risk assessment on a scale of 1-10

Return JSON: {
  "summary": string,
  "keyPoints": string[],
  "suggestions": string[],
  "riskScore": number,
  "contractDetails": {
    "parties": string[],
    "effectiveDate": string,
    "termLength": string,
    "keyObligations": string[],
    "terminationClauses": string[]
  }
}`;

    case "COMPLIANCE_AUDITING":
      return `You are a compliance auditing AI. Analyze documents for:
1. Regulatory compliance status
2. Policy adherence
3. Documentation completeness
4. Risk areas and gaps
5. Required actions for compliance

Return JSON: {"summary": string, "keyPoints": string[], "suggestions": string[], "riskScore": number}`;

    case "LEGAL_RESEARCH":
      return `You are a legal research AI. Focus on:
1. Case law relevance
2. Legal precedent analysis
3. Jurisdiction-specific requirements
4. Citations and references
5. Application to current case

Return JSON: {"summary": string, "keyPoints": string[], "suggestions": string[], "riskScore": number}`;

    default:
      return `You are a legal analyst. Analyze the document section and provide:
1. Brief summary
2. Key legal points
3. Suggestions
4. Risk assessment (1-10)

Return JSON: {"summary": string, "keyPoints": string[], "suggestions": string[], "riskScore": number}`;
  }
}

async function analyzeChunk(chunk: string, agentType: AgentType, attempt: number = 0): Promise<any> {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: getSystemPromptForAgent(agentType)
      },
      {
        role: "user",
        content: chunk,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 500,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  return JSON.parse(content);
}

async function processChunkWithRetry(chunk: string, agentType: AgentType): Promise<any> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await analyzeChunk(chunk, agentType, attempt);
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === MAX_RETRIES - 1) throw error;
      await wait(INITIAL_RETRY_DELAY * Math.pow(2, attempt));
    }
  }
  throw new Error("Failed after maximum retries");
}

export async function analyzeDocument(text: string, agentType: AgentType): Promise<DocumentAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  const chunks = splitIntoChunks(text);
  console.log(`Split document into ${chunks.length} chunks`);

  const results: any[] = [];

  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = chunks.slice(i, i + MAX_CONCURRENT_REQUESTS);
    const batchResults = await Promise.all(
      batch.map((chunk, index) => {
        console.log(`Processing chunk ${i + index + 1}/${chunks.length}`);
        return processChunkWithRetry(chunk, agentType);
      })
    );
    results.push(...batchResults);
  }

  // Combine results with special handling for contract automation
  const combinedAnalysis: DocumentAnalysis = {
    summary: results.map(r => r.summary).join(" "),
    keyPoints: Array.from(new Set(results.flatMap(r => r.keyPoints))),
    suggestions: Array.from(new Set(results.flatMap(r => r.suggestions))),
    riskScore: Math.round(
      results.reduce((acc, r) => {
        const weight = r.riskScore > 7 ? 1.5 : 1;
        return acc + (r.riskScore * weight);
      }, 0) / (results.length + (results.filter(r => r.riskScore > 7).length * 0.5))
    ),
  };

  // Add contract details if using contract automation agent
  if (agentType === "CONTRACT_AUTOMATION") {
    const contractDetails = results.reduce((acc, r) => ({
      parties: [...new Set([...(acc.parties || []), ...(r.contractDetails?.parties || [])])],
      effectiveDate: r.contractDetails?.effectiveDate || acc.effectiveDate,
      termLength: r.contractDetails?.termLength || acc.termLength,
      keyObligations: [...new Set([...(acc.keyObligations || []), ...(r.contractDetails?.keyObligations || [])])],
      terminationClauses: [...new Set([...(acc.terminationClauses || []), ...(r.contractDetails?.terminationClauses || [])])],
    }), {});

    combinedAnalysis.contractDetails = contractDetails;
  }

  return combinedAnalysis;
}

export async function chatWithDocument(
  message: string,
  context: string,
  analysis: DocumentAnalysis,
  agentType: AgentType = "CONTRACT_AUTOMATION"
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a specialized ${agentType.toLowerCase().replace('_', ' ')} assistant. 
          Current analysis summary: ${analysis.summary}
          Risk score: ${analysis.riskScore}/10
          ${agentType === "CONTRACT_AUTOMATION" && analysis.contractDetails ? `
          Contract Details:
          - Parties: ${analysis.contractDetails.parties?.join(', ')}
          - Effective Date: ${analysis.contractDetails.effectiveDate}
          - Term Length: ${analysis.contractDetails.termLength}
          - Key Obligations: ${analysis.contractDetails.keyObligations?.join(', ')}
          - Termination Clauses: ${analysis.contractDetails.terminationClauses?.join(', ')}
          ` : ''}

          Answer user questions with specific, accurate information. Provide clear statistics and explain calculations when asked.
          If asked about modifying the analysis, explain your reasoning and suggest specific changes.
          Keep responses focused on legal implications and practical insights.`
        },
        {
          role: "user",
          content: `Context: ${context.substring(0, 2000)}...

          User question: ${message}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    return response.choices[0].message.content || "I apologize, but I couldn't generate a response. Please try rephrasing your question.";
  } catch (error) {
    console.error('Error in chat:', error);
    throw new Error("Failed to process chat request");
  }
}