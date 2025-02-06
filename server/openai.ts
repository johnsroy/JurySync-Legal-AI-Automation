import OpenAI from "openai";
import type { AgentType, DocumentAnalysis } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const MAX_CHUNK_LENGTH = 1500; // Reduced from 2000
const MAX_CONCURRENT_REQUESTS = 2; // Reduced from 3

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
  const basePrompt = `You are a legal AI assistant. Analyze the provided text and return a JSON object. Keep all responses concise and focused on key points. Ensure all arrays have at least one item.`;

  switch (agentType) {
    case "CONTRACT_AUTOMATION":
      return `${basePrompt} Return ONLY a JSON object with this structure:
{
  "summary": "2-3 sentence summary",
  "keyPoints": ["point 1", "point 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "riskScore": number between 1-10,
  "contractDetails": {
    "parties": ["party 1"],
    "effectiveDate": "date",
    "termLength": "duration",
    "keyObligations": ["obligation"],
    "terminationClauses": ["clause"],
    "governingLaw": "jurisdiction",
    "paymentTerms": "terms",
    "disputeResolution": "method",
    "missingClauses": ["clause"],
    "suggestedClauses": ["clause"],
    "riskFactors": ["risk"]
  }
}`;

    default:
      return `${basePrompt} Return ONLY a JSON object with this structure:
{
  "summary": "2-3 sentence summary",
  "keyPoints": ["point 1", "point 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "riskScore": number between 1-10
}`;
  }
}

async function analyzeChunk(chunk: string, agentType: AgentType): Promise<DocumentAnalysis> {
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
          content: `Analyze this text section: ${chunk}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 500
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    let analysis: DocumentAnalysis;
    try {
      analysis = JSON.parse(content);
    } catch (error) {
      console.error("Failed to parse OpenAI response:", content);
      throw new Error("Invalid JSON response from OpenAI");
    }

    // Validate the analysis structure
    if (!analysis.summary || !analysis.keyPoints?.length || !analysis.suggestions?.length || 
        typeof analysis.riskScore !== 'number' || analysis.riskScore < 1 || analysis.riskScore > 10) {
      throw new Error("Invalid analysis structure from OpenAI");
    }

    return analysis;
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}

async function processChunkWithRetry(chunk: string, agentType: AgentType): Promise<DocumentAnalysis> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await analyzeChunk(chunk, agentType);
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === MAX_RETRIES - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, INITIAL_RETRY_DELAY * Math.pow(2, attempt)));
    }
  }
  throw new Error("Failed after maximum retries");
}

export async function analyzeDocument(text: string, agentType: AgentType): Promise<DocumentAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  // Split text into smaller chunks
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

  console.log(`Split document into ${chunks.length} chunks`);

  const results: DocumentAnalysis[] = [];
  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = chunks.slice(i, i + MAX_CONCURRENT_REQUESTS);
    try {
      const batchResults = await Promise.all(
        batch.map(async (chunk, index) => {
          console.log(`Processing chunk ${i + index + 1}/${chunks.length}`);
          return processChunkWithRetry(chunk, agentType);
        })
      );
      results.push(...batchResults);
    } catch (error) {
      console.error("Failed to process document chunk:", error);
      throw new Error("Failed to analyze document completely");
    }
  }

  // Combine results
  const combinedAnalysis: DocumentAnalysis = {
    summary: results.map(r => r.summary).join(" "),
    keyPoints: Array.from(new Set(results.flatMap(r => r.keyPoints))),
    suggestions: Array.from(new Set(results.flatMap(r => r.suggestions))),
    riskScore: Math.round(results.reduce((acc, r) => acc + r.riskScore, 0) / results.length)
  };

  // Combine contract details if present
  if (agentType === "CONTRACT_AUTOMATION") {
    const details = results.reduce((acc, r) => {
      if (!r.contractDetails) return acc;
      return {
        parties: Array.from(new Set([...(acc.parties || []), ...(r.contractDetails.parties || [])])),
        effectiveDate: r.contractDetails.effectiveDate || acc.effectiveDate,
        termLength: r.contractDetails.termLength || acc.termLength,
        keyObligations: Array.from(new Set([...(acc.keyObligations || []), ...(r.contractDetails.keyObligations || [])])),
        terminationClauses: Array.from(new Set([...(acc.terminationClauses || []), ...(r.contractDetails.terminationClauses || [])])),
        governingLaw: r.contractDetails.governingLaw || acc.governingLaw,
        paymentTerms: r.contractDetails.paymentTerms || acc.paymentTerms,
        disputeResolution: r.contractDetails.disputeResolution || acc.disputeResolution,
        missingClauses: Array.from(new Set([...(acc.missingClauses || []), ...(r.contractDetails.missingClauses || [])])),
        suggestedClauses: Array.from(new Set([...(acc.suggestedClauses || []), ...(r.contractDetails.suggestedClauses || [])])),
        riskFactors: Array.from(new Set([...(acc.riskFactors || []), ...(r.contractDetails.riskFactors || [])]))
      };
    }, {} as DocumentAnalysis['contractDetails']);

    combinedAnalysis.contractDetails = details;
  }

  return combinedAnalysis;
}

export async function chatWithDocument(
  message: string,
  context: string,
  analysis: DocumentAnalysis
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
          content: `You are a legal document assistant. Use the provided analysis to answer questions accurately and concisely.

          Document Summary: ${analysis.summary}
          Risk Score: ${analysis.riskScore}/10`
        },
        {
          role: "user",
          content: `Context: ${context.substring(0, 1500)}...

          Question: ${message}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    return response.choices[0].message.content || 
           "I apologize, but I couldn't generate a response. Please try rephrasing your question.";
  } catch (error) {
    console.error('Error in chat:', error);
    throw new Error("Failed to process chat request");
  }
}