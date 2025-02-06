import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_CHUNK_LENGTH = 2000; // Reduced from 4000 for faster processing
const MAX_CONCURRENT_REQUESTS = 3; // Number of parallel requests

export interface DocumentAnalysis {
  summary: string;
  keyPoints: string[];
  suggestions: string[];
  riskScore: number;
}

interface AIResponse {
  summary: string;
  keyPoints: string[];
  suggestions: string[];
  riskScore: number;
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function splitIntoChunks(text: string): string[] {
  // Split into semantic sections using common legal document markers
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

async function analyzeChunk(chunk: string, attempt: number = 0): Promise<AIResponse> {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `You are a legal analyst. Analyze the document section and provide:
1. Brief summary (1-2 sentences)
2. Key legal points (max 2 points)
3. Suggestions (max 2)
4. Risk score (1-10) based on:
   - Regulatory compliance (1-3)
   - Contractual clarity (4-6)
   - Litigation risk (7-8)
   - Critical issues (9-10)
Return JSON: {"summary": string, "keyPoints": string[], "suggestions": string[], "riskScore": number}`
      },
      {
        role: "user",
        content: chunk,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3, // Reduced for more consistent and faster responses
    max_tokens: 500, // Limiting response length
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  return JSON.parse(content) as AIResponse;
}

async function processChunkWithRetry(chunk: string): Promise<AIResponse> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await analyzeChunk(chunk, attempt);
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === MAX_RETRIES - 1) throw error;
      await wait(INITIAL_RETRY_DELAY * Math.pow(2, attempt));
    }
  }
  throw new Error("Failed after maximum retries");
}

export async function analyzeDocument(text: string): Promise<DocumentAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  const chunks = splitIntoChunks(text);
  console.log(`Split document into ${chunks.length} chunks`);

  const results: AIResponse[] = [];

  // Process chunks in parallel with rate limiting
  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = chunks.slice(i, i + MAX_CONCURRENT_REQUESTS);
    const batchResults = await Promise.all(
      batch.map((chunk, index) => {
        console.log(`Processing chunk ${i + index + 1}/${chunks.length}`);
        return processChunkWithRetry(chunk);
      })
    );
    results.push(...batchResults);
  }

  // Combine results with weighted averaging for risk scores
  const combinedAnalysis: DocumentAnalysis = {
    summary: results.map(r => r.summary).join(" "),
    keyPoints: Array.from(new Set(results.flatMap(r => r.keyPoints))),
    suggestions: Array.from(new Set(results.flatMap(r => r.suggestions))),
    riskScore: Math.round(
      results.reduce((acc, r, idx) => {
        // Give more weight to higher risk scores
        const weight = r.riskScore > 7 ? 1.5 : 1;
        return acc + (r.riskScore * weight);
      }, 0) / (results.length + (results.filter(r => r.riskScore > 7).length * 0.5))
    ),
  };

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
          content: `You are a legal document analysis assistant. You have access to the document content and its analysis. 
          Current analysis summary: ${analysis.summary}
          Risk score: ${analysis.riskScore}/10

          Answer user questions about the document with specific, accurate information. If asked for analytics or numbers, provide clear statistics and explain your calculations.
          If the user asks to modify the analysis, explain your reasoning and suggest specific changes.

          Keep responses concise and focused on the legal implications and practical insights.`
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