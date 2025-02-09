import { ChromaClient, Collection } from 'chromadb';
import { Document } from '@shared/schema';

export class ChromaStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private initialized = false;
  private inMemoryMode = true;

  constructor() {
    this.client = new ChromaClient({
      path: "memory" // Use in-memory mode to avoid external server dependency
    });
  }

  private async ensureCollection() {
    if (this.initialized) return;

    try {
      this.collection = await this.client.getOrCreateCollection({
        name: "legal_documents",
        metadata: { "hnsw:space": "cosine" }
      });
      this.initialized = true;
      console.log("ChromaDB collection initialized successfully in memory");
    } catch (error) {
      console.error('Failed to initialize ChromaDB collection:', error);
      // Don't throw error, just log it and continue
      // This allows the application to function without vector storage
    }
  }

  async addDocument(document: Document, content: string) {
    try {
      await this.ensureCollection();
      if (!this.collection) {
        console.warn('ChromaDB collection not available, skipping vector storage');
        return;
      }

      await this.collection.add({
        ids: [document.id.toString()],
        metadatas: [{
          title: document.title,
          userId: document.userId,
          createdAt: new Date().toISOString()
        }],
        documents: [content]
      });
      console.log(`Document ${document.id} added to ChromaDB successfully`);
    } catch (error) {
      console.error(`Failed to add document ${document.id} to ChromaDB:`, error);
      // Don't throw error, just log it
      // This allows the application to continue working without vector storage
    }
  }

  async getDocument(id: string): Promise<string | null> {
    try {
      await this.ensureCollection();
      if (!this.collection) {
        console.warn('ChromaDB collection not available, skipping vector retrieval');
        return null;
      }

      const result = await this.collection.get({
        ids: [id]
      });

      if (result.documents.length > 0) {
        return result.documents[0];
      }
      return null;
    } catch (error) {
      console.error(`Failed to get document ${id} from ChromaDB:`, error);
      return null;
    }
  }

  // Add method to check if vector store is available
  async isAvailable(): Promise<boolean> {
    try {
      await this.ensureCollection();
      return this.collection !== null;
    } catch (error) {
      return false;
    }
  }
}

export const chromaStore = new ChromaStore();