import { ChromaClient, Collection } from 'chromadb';
import { Document } from '@shared/schema';

export class ChromaStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private initialized = false;

  constructor() {
    // Using in-memory configuration to avoid external server dependency
    this.client = new ChromaClient({
      path: undefined // This will use in-memory mode
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
      console.log("ChromaDB collection initialized successfully");
    } catch (error) {
      console.error('Failed to initialize ChromaDB collection:', error);
      throw error;
    }
  }

  async addDocument(document: Document, content: string) {
    await this.ensureCollection();
    if (!this.collection) throw new Error('Collection not initialized');

    try {
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
      throw error;
    }
  }

  async getDocument(id: string): Promise<string | null> {
    await this.ensureCollection();
    if (!this.collection) throw new Error('Collection not initialized');

    try {
      const result = await this.collection.get({
        ids: [id]
      });

      if (result.documents.length > 0) {
        return result.documents[0];
      }
      return null;
    } catch (error) {
      console.error(`Failed to get document ${id} from ChromaDB:`, error);
      throw error;
    }
  }
}

export const chromaStore = new ChromaStore();