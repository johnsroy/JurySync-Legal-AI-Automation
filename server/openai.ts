import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_CHUNK_LENGTH = 4000; // Conservative limit to ensure we stay within token limits

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
  // Split into sentences (roughly) and then combine into chunks
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > MAX_CHUNK_LENGTH) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
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
        content: `You are an expert legal analyst with extensive experience in contract law, compliance, and risk assessment. Analyze the provided legal document section and provide a comprehensive analysis focusing on:

1. Legal implications and potential risks
2. Compliance requirements and regulatory considerations
3. Precedent relevance and case law implications
4. Contractual obligations and liabilities
5. Recommended actions for legal professionals

Return a JSON object with the following structure:
{
  "summary": "A concise executive summary highlighting the most critical legal aspects and immediate concerns",
  "keyPoints": [
    "List key legal points, obligations, rights, and potential liabilities",
    "Include relevant statutory references and legal principles",
    "Highlight time-sensitive matters and deadlines",
    "Note any unusual or non-standard clauses"
  ],
  "suggestions": [
    "Specific actionable recommendations for legal professionals",
    "Risk mitigation strategies",
    "Compliance requirements and next steps",
    "Areas requiring additional legal review or expert consultation"
  ],
  "riskScore": "A number from 1-10 representing overall legal risk, considering:
    - Regulatory compliance (1-3)
    - Contractual clarity (4-6)
    - Potential litigation risk (7-8)
    - Immediate legal action required (9-10)"
}`
      },
      {
        role: "user",
        content: chunk,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  return JSON.parse(content) as AIResponse;
}

export async function analyzeDocument(text: string): Promise<DocumentAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  const chunks = splitIntoChunks(text);
  console.log(`Split document into ${chunks.length} chunks`);

  let lastError: Error | null = null;
  const results: AIResponse[] = [];

  for (const chunk of chunks) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        console.log(`Processing chunk ${results.length + 1}/${chunks.length}, attempt ${attempt + 1}`);
        const result = await analyzeChunk(chunk);
        results.push(result);
        break;
      } catch (error) {
        lastError = error as Error;
        console.error(`OpenAI API Error (Chunk ${results.length + 1}, Attempt ${attempt + 1}):`, error);

        if (error instanceof Error) {
          if (error.message.includes("429") || error.message.toLowerCase().includes("rate limit")) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
            console.log(`Rate limit hit. Waiting ${delay}ms before retry...`);
            await wait(delay);
            continue;
          }
        }

        if (attempt === MAX_RETRIES - 1) {
          throw new Error(`Failed to analyze document chunk: ${lastError?.message}`);
        }
      }
    }
  }

  // Combine results from all chunks
  const combinedAnalysis: DocumentAnalysis = {
    summary: results.map(r => r.summary).join(" "),
    keyPoints: Array.from(new Set(results.flatMap(r => r.keyPoints))),
    suggestions: Array.from(new Set(results.flatMap(r => r.suggestions))),
    riskScore: Math.round(results.reduce((acc, r) => acc + r.riskScore, 0) / results.length),
  };

  return combinedAnalysis;
}