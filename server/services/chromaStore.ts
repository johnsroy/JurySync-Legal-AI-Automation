import { ChromaClient, Collection } from 'chromadb';
import { Document } from '@shared/schema';

interface ChromaDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
}

interface ChromaResponse {
  id: string;
  metadata: Record<string, any>;
}

export class ChromaStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private initialized = false;

  constructor() {
    this.client = new ChromaClient({
      path: "http://localhost:8000"
    });
  }

  private async ensureCollection() {
    if (this.initialized) return;

    try {
      this.collection = await this.client.createCollection({
        name: "legal_documents",
        metadata: { "hnsw:space": "cosine" }
      });

      this.initialized = true;
      console.log("ChromaDB collection initialized successfully");
    } catch (error) {
      console.error('Failed to initialize ChromaDB collection:', error);
      this.collection = null;
    }
  }

  async addDocument(document: ChromaDocument): Promise<ChromaResponse> {
    try {
      await this.ensureCollection();
      if (!this.collection) {
        console.warn('ChromaDB collection not available, skipping vector storage');
        return { id: document.id, metadata: document.metadata };
      }

      await this.collection.add({
        ids: [document.id],
        metadatas: [document.metadata],
        documents: [document.content]
      });

      console.log(`Document ${document.id} added to ChromaDB successfully`);
      return { id: document.id, metadata: document.metadata };
    } catch (error) {
      console.error(`Failed to add document ${document.id} to ChromaDB:`, error);
      // Return the document ID even if storage fails
      return { id: document.id, metadata: document.metadata };
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