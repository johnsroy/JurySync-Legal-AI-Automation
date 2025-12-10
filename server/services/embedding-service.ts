import OpenAI from "openai";
import { ChromaClient, Collection } from 'chromadb';
import { v4 as uuidv4 } from 'uuid';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize ChromaDB client
let chromaClient: ChromaClient | null = null;
let legalDocumentsCollection: Collection | null = null;

// Initialize ChromaDB connection
async function initializeChroma(): Promise<void> {
  if (chromaClient && legalDocumentsCollection) {
    return;
  }

  try {
    chromaClient = new ChromaClient();
    legalDocumentsCollection = await chromaClient.getOrCreateCollection({
      name: "legal_research_documents",
      metadata: {
        description: "Legal documents for research and similarity search"
      }
    });
    console.log("ChromaDB collection initialized successfully");
  } catch (error) {
    console.error("Failed to initialize ChromaDB:", error);
    // Continue without ChromaDB - use in-memory fallback
  }
}

// Initialize on module load
initializeChroma().catch(console.error);

/**
 * Creates an embedding vector for the given text using OpenAI's embedding model
 * @param text - The text to create an embedding for
 * @returns A numerical embedding vector (1536 dimensions for text-embedding-3-small)
 */
export async function createEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  try {
    // Truncate text if too long (max ~8000 tokens for embedding model)
    const truncatedText = text.substring(0, 30000);

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: truncatedText,
    });

    return response.data[0].embedding;
  } catch (error: any) {
    console.error("Error creating embedding:", error);
    throw new Error(`Failed to create embedding: ${error.message}`);
  }
}

/**
 * Creates an embedding and stores it in ChromaDB
 * @param id - Unique identifier for the document
 * @param text - The text content to embed
 * @param metadata - Additional metadata to store with the embedding
 * @returns The generated embedding ID
 */
export async function createAndStoreEmbedding(
  id: string,
  text: string,
  metadata: Record<string, any> = {}
): Promise<string> {
  await initializeChroma();

  const embedding = await createEmbedding(text);
  const embeddingId = id || uuidv4();

  if (legalDocumentsCollection) {
    await legalDocumentsCollection.add({
      ids: [embeddingId],
      embeddings: [embedding],
      metadatas: [{ ...metadata, timestamp: new Date().toISOString() }],
      documents: [text.substring(0, 10000)] // Store truncated text for reference
    });
  }

  return embeddingId;
}

/**
 * Searches for similar documents using cosine similarity
 * @param query - The query text to search for
 * @param limit - Maximum number of results to return
 * @returns Array of similar document IDs with their distances
 */
export async function searchSimilarDocuments(
  query: string,
  limit: number = 10
): Promise<{
  ids: string[];
  distances: number[];
  documents: string[];
  metadatas: Record<string, any>[];
}> {
  await initializeChroma();

  if (!legalDocumentsCollection) {
    return { ids: [], distances: [], documents: [], metadatas: [] };
  }

  const queryEmbedding = await createEmbedding(query);

  const results = await legalDocumentsCollection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: limit
  });

  return {
    ids: results.ids?.[0] || [],
    distances: results.distances?.[0] || [],
    documents: results.documents?.[0] || [],
    metadatas: results.metadatas?.[0] || []
  };
}

/**
 * Calculates cosine similarity between two embedding vectors
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Cosine similarity score (0-1)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Batch creates embeddings for multiple texts
 * @param texts - Array of texts to create embeddings for
 * @returns Array of embedding vectors
 */
export async function createBatchEmbeddings(texts: string[]): Promise<number[][]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  try {
    // Truncate each text
    const truncatedTexts = texts.map(text => text.substring(0, 30000));

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: truncatedTexts,
    });

    return response.data.map(item => item.embedding);
  } catch (error: any) {
    console.error("Error creating batch embeddings:", error);
    throw new Error(`Failed to create batch embeddings: ${error.message}`);
  }
}

/**
 * Deletes an embedding from ChromaDB by ID
 * @param id - The ID of the embedding to delete
 */
export async function deleteEmbedding(id: string): Promise<void> {
  await initializeChroma();

  if (legalDocumentsCollection) {
    await legalDocumentsCollection.delete({
      ids: [id]
    });
  }
}

/**
 * Updates an existing embedding in ChromaDB
 * @param id - The ID of the embedding to update
 * @param text - The new text content
 * @param metadata - Updated metadata
 */
export async function updateEmbedding(
  id: string,
  text: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  await initializeChroma();

  const embedding = await createEmbedding(text);

  if (legalDocumentsCollection) {
    await legalDocumentsCollection.update({
      ids: [id],
      embeddings: [embedding],
      metadatas: [{ ...metadata, updatedAt: new Date().toISOString() }],
      documents: [text.substring(0, 10000)]
    });
  }
}
