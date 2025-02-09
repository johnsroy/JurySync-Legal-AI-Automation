import { ChromaClient, Collection } from 'chromadb';
import { Document } from '@shared/schema';

export class ChromaStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private initialized = false;

  constructor() {
    // Initialize ChromaDB with proper configuration for in-memory mode
    this.client = new ChromaClient({
      path: "http://localhost:8000" // Use HTTP protocol for in-memory mode
    });
  }

  private async ensureCollection() {
    if (this.initialized) return;

    try {
      // Create collection with proper configuration
      this.collection = await this.client.createCollection({
        name: "legal_documents",
        metadata: { "hnsw:space": "cosine" }
      });

      this.initialized = true;
      console.log("ChromaDB collection initialized successfully");
    } catch (error) {
      console.error('Failed to initialize ChromaDB collection:', error);
      // Set collection to null but don't throw error
      // This allows the application to continue without vector storage
      this.collection = null;
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
        ids: [id],
        include: ["documents"]
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

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.heartbeat();
      return true;
    } catch (error) {
      console.error('ChromaDB is not available:', error);
      return false;
    }
  }
}

export const chromaStore = new ChromaStore();