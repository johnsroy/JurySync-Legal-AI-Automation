import OpenAI from "openai";
import type { AgentType, DocumentAnalysis } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const MAX_CHUNK_LENGTH = 2000;
const MAX_CONCURRENT_REQUESTS = 3;

// Helper functions
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
      return `You are a specialized legal contract analysis AI. Analyze the provided contract section and return ONLY a JSON object with the following structure:
{
  "summary": "Brief summary of the section",
  "keyPoints": ["key point 1", "key point 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "riskScore": number between 1-10,
  "contractDetails": {
    "parties": ["party 1", "party 2"],
    "effectiveDate": "date if found",
    "termLength": "term length if found",
    "keyObligations": ["obligation 1", "obligation 2"],
    "terminationClauses": ["clause 1", "clause 2"],
    "governingLaw": "law if found",
    "paymentTerms": "terms if found",
    "disputeResolution": "resolution method if found",
    "missingClauses": ["missing clause 1", "missing clause 2"],
    "suggestedClauses": ["suggested clause 1", "suggested clause 2"],
    "riskFactors": ["risk 1", "risk 2"]
  }
}`;

    case "COMPLIANCE_AUDITING":
      return `You are a compliance auditing AI. Analyze the document section and return ONLY a JSON object with the following structure:
{
  "summary": "Brief summary of compliance findings",
  "keyPoints": ["key point 1", "key point 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "riskScore": number between 1-10
}`;

    case "LEGAL_RESEARCH":
      return `You are a legal research AI. Analyze the document section and return ONLY a JSON object with the following structure:
{
  "summary": "Brief summary of legal findings",
  "keyPoints": ["key point 1", "key point 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "riskScore": number between 1-10
}`;

    default:
      return `Analyze the document section and return ONLY a JSON object with the following structure:
{
  "summary": "Brief summary",
  "keyPoints": ["key point 1", "key point 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "riskScore": number between 1-10
}`;
  }
}

async function analyzeChunk(chunk: string, agentType: AgentType): Promise<any> {
  try {
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
      max_tokens: 800,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      console.error("Failed to parse OpenAI response:", content);
      throw new Error("Failed to parse OpenAI response");
    }
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}

async function processChunkWithRetry(chunk: string, agentType: AgentType): Promise<any> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await analyzeChunk(chunk, agentType);
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
    try {
      const batchResults = await Promise.all(
        batch.map((chunk, index) => {
          console.log(`Processing chunk ${i + index + 1}/${chunks.length}`);
          return processChunkWithRetry(chunk, agentType);
        })
      );
      results.push(...batchResults);
    } catch (error) {
      console.error("Failed to process batch:", error);
      throw new Error("Failed to analyze document");
    }
  }

  // Combine results
  const combinedAnalysis: DocumentAnalysis = {
    summary: results.map(r => r.summary).join(" "),
    keyPoints: Array.from(new Set(results.flatMap(r => r.keyPoints))),
    suggestions: Array.from(new Set(results.flatMap(r => r.suggestions))),
    riskScore: Math.round(
      results.reduce((acc, r) => acc + (r.riskScore || 0), 0) / results.length
    ),
  };

  // Add contract details if using contract automation agent
  if (agentType === "CONTRACT_AUTOMATION") {
    const details = results.reduce((acc, r) => {
      if (!r.contractDetails) return acc;
      return {
        parties: [...new Set([...(acc.parties || []), ...(r.contractDetails.parties || [])])],
        effectiveDate: r.contractDetails.effectiveDate || acc.effectiveDate,
        termLength: r.contractDetails.termLength || acc.termLength,
        keyObligations: [...new Set([...(acc.keyObligations || []), ...(r.contractDetails.keyObligations || [])])],
        terminationClauses: [...new Set([...(acc.terminationClauses || []), ...(r.contractDetails.terminationClauses || [])])],
        governingLaw: r.contractDetails.governingLaw || acc.governingLaw,
        paymentTerms: r.contractDetails.paymentTerms || acc.paymentTerms,
        disputeResolution: r.contractDetails.disputeResolution || acc.disputeResolution,
        missingClauses: [...new Set([...(acc.missingClauses || []), ...(r.contractDetails.missingClauses || [])])],
        suggestedClauses: [...new Set([...(acc.suggestedClauses || []), ...(r.contractDetails.suggestedClauses || [])])],
        riskFactors: [...new Set([...(acc.riskFactors || []), ...(r.contractDetails.riskFactors || [])])],
      };
    }, {} as DocumentAnalysis['contractDetails']);

    combinedAnalysis.contractDetails = details;
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
          - Parties: ${analysis.contractDetails.parties?.join(', ') || 'N/A'}
          - Effective Date: ${analysis.contractDetails.effectiveDate || 'N/A'}
          - Term Length: ${analysis.contractDetails.termLength || 'N/A'}
          - Key Obligations: ${analysis.contractDetails.keyObligations?.join(', ') || 'N/A'}
          - Termination Clauses: ${analysis.contractDetails.terminationClauses?.join(', ') || 'N/A'}
          - Governing Law: ${analysis.contractDetails.governingLaw || 'N/A'}
          - Payment Terms: ${analysis.contractDetails.paymentTerms || 'N/A'}
          - Dispute Resolution: ${analysis.contractDetails.disputeResolution || 'N/A'}
          ` : ''}

          Answer user questions with specific, accurate information. Provide clear statistics and explain calculations when asked.`
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