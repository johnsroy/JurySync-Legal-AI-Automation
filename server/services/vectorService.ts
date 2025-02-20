import { ChromaClient, Collection } from 'chromadb';
import { OpenAI } from 'openai';
import { v4 as uuidv4 } from 'uuid';

const openai = new OpenAI();
const chroma = new ChromaClient();

let documentCollection: Collection;

async function initializeCollection() {
  try {
    documentCollection = await chroma.getOrCreateCollection({
      name: "legal_documents",
      metadata: { 
        "description": "Legal document embeddings for similarity search"
      }
    });
  } catch (error) {
    console.error("Failed to initialize vector collection:", error);
    throw error;
  }
}

// Initialize collection on startup
initializeCollection().catch(console.error);

export async function createVectorEmbedding(content: string) {
  try {
    // Generate embedding using OpenAI
    const embedding = await openai.embeddings.create({
      input: content,
      model: "text-embedding-3-small"
    });

    // Store in ChromaDB
    const id = uuidv4();
    await documentCollection.add({
      ids: [id],
      embeddings: [embedding.data[0].embedding],
      metadatas: [{ timestamp: new Date().toISOString() }],
      documents: [content]
    });

    return { id, embedding: embedding.data[0].embedding };
  } catch (error) {
    console.error("Error creating vector embedding:", error);
    throw new Error("Failed to create document embedding");
  }
}

export async function findSimilarDocuments(content: string, limit: number = 5) {
  try {
    const embedding = await openai.embeddings.create({
      input: content,
      model: "text-embedding-3-small"
    });

    const results = await documentCollection.query({
      queryEmbeddings: [embedding.data[0].embedding],
      nResults: limit
    });

    return results;
  } catch (error) {
    console.error("Error finding similar documents:", error);
    throw new Error("Failed to find similar documents");
  }
}
