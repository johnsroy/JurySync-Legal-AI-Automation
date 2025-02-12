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
  private metricsCollection: Collection | null = null;
  private initialized = false;

  constructor() {
    this.client = new ChromaClient({
      path: "http://localhost:8000"
    });
  }

  private async ensureCollections() {
    if (this.initialized) return;

    try {
      // Create collections for documents and metrics
      this.collection = await this.client.createCollection({
        name: "legal_documents",
        metadata: { "hnsw:space": "cosine" }
      });

      this.metricsCollection = await this.client.createCollection({
        name: "model_metrics",
        metadata: { description: "Model performance and analytics data" }
      });

      this.initialized = true;
      console.log("ChromaDB collections initialized successfully");
    } catch (error) {
      console.error('Failed to initialize ChromaDB collections:', error);
      this.collection = null;
      this.metricsCollection = null;
    }
  }

  async storeMetrics(data: {
    modelId: string;
    metrics: number[];
    metadata: Record<string, any>;
  }) {
    try {
      await this.ensureCollections();
      if (!this.metricsCollection) {
        console.warn('ChromaDB metrics collection not available');
        return null;
      }

      await this.metricsCollection.add({
        ids: [`${data.modelId}_${Date.now()}`],
        embeddings: [data.metrics],
        metadatas: [{
          ...data.metadata,
          modelId: data.modelId,
          timestamp: new Date().toISOString()
        }]
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to store metrics in ChromaDB:', error);
      return { success: false, error };
    }
  }

  async getRecentMetrics(limit: number = 10): Promise<any[]> {
    try {
      await this.ensureCollections();
      if (!this.metricsCollection) {
        console.warn('ChromaDB metrics collection not available');
        return [];
      }

      const result = await this.metricsCollection.peek(limit);

      return result.metadatas?.map((metadata, index) => ({
        ...metadata,
        embeddings: result.embeddings?.[index]
      })) || [];
    } catch (error) {
      console.error('Failed to get recent metrics from ChromaDB:', error);
      return [];
    }
  }

  async addDocument(document: ChromaDocument): Promise<ChromaResponse> {
    try {
      await this.ensureCollections();
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
      return { id: document.id, metadata: document.metadata };
    }
  }

  async getDocument(id: string): Promise<string | null> {
    try {
      await this.ensureCollections();
      if (!this.collection) {
        console.warn('ChromaDB collection not available');
        return null;
      }

      const result = await this.collection.get({
        ids: [id]
      });

      if (result.documents?.[0]) {
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