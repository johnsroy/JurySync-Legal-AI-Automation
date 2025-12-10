import { OpenAI } from "openai";

const openai = new OpenAI();

/**
 * Creates an embedding vector for the given text using OpenAI's embedding model
 * @param text - The text to create an embedding for
 * @returns A number array representing the embedding vector
 */
export async function createEmbedding(text: string): Promise<number[]> {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    // Truncate text if it's too long (OpenAI has a token limit)
    const MAX_CHARS = 8000;
    const truncatedText = text.length > MAX_CHARS
      ? text.substring(0, MAX_CHARS)
      : text;

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: truncatedText,
    });

    if (!response.data || response.data.length === 0) {
      throw new Error("No embedding returned from OpenAI");
    }

    return response.data[0].embedding;
  } catch (error) {
    console.error("Error creating embedding:", error);
    throw new Error(`Failed to create embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Creates embeddings for multiple texts in batch
 * @param texts - Array of texts to create embeddings for
 * @returns Array of embedding vectors
 */
export async function createBatchEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    if (!texts || texts.length === 0) {
      return [];
    }

    // Filter out empty texts and truncate long ones
    const MAX_CHARS = 8000;
    const processedTexts = texts
      .filter(text => text && text.trim().length > 0)
      .map(text => text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) : text);

    if (processedTexts.length === 0) {
      return [];
    }

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: processedTexts,
    });

    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error("Error creating batch embeddings:", error);
    throw new Error(`Failed to create batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculates cosine similarity between two embedding vectors
 * @param embedding1 - First embedding vector
 * @param embedding2 - Second embedding vector
 * @returns Cosine similarity score (0-1)
 */
export function cosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error("Embeddings must have the same length");
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    magnitude1 += embedding1[i] * embedding1[i];
    magnitude2 += embedding2[i] * embedding2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}
