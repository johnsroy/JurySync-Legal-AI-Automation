import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

export async function findSimilarDocuments(query: string, limit: number = 10): Promise<string[]> {
  try {
    const embedding = await generateEmbedding(query);
    // For now, return empty array since we're not storing embeddings yet
    return [];
  } catch (error) {
    console.error('Error finding similar documents:', error);
    throw new Error('Failed to find similar documents');
  }
}
