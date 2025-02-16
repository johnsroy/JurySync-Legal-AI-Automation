export interface VaultDocument {
  id: string;
  fileName: string;
  documentType: string;
  industry: string;
  complianceStatus: string;
  timestamp: string;
  content: string;
  metadata?: {
    confidence: number;
    recommendations: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

export const documentStore = {
  saveDocument(document: Omit<VaultDocument, 'id' | 'timestamp'>) {
    try {
      const documents = this.getDocuments();
      const newDocument = {
        ...document,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
      };
      
      documents.unshift(newDocument);
      const documentsString = JSON.stringify(documents);
      localStorage.setItem('vaultDocuments', documentsString);
      console.log('Saved documents:', documentsString);
      
      // Dispatch both storage and custom events
      this.dispatchStorageEvent();
      window.dispatchEvent(new CustomEvent('vaultUpdated'));
      
      return newDocument;
    } catch (error) {
      console.error('Error saving document:', error);
      throw new Error('Failed to save document');
    }
  },

  getDocuments(): VaultDocument[] {
    try {
      const stored = localStorage.getItem('vaultDocuments');
      console.log('Raw stored documents:', stored);
      if (!stored) return [];
      const documents = JSON.parse(stored);
      console.log('Parsed documents:', documents);
      return documents;
    } catch (error) {
      console.error('Error getting documents:', error);
      return [];
    }
  },

  deleteDocument(id: string) {
    try {
      const documents = this.getDocuments();
      const filtered = documents.filter(doc => doc.id !== id);
      localStorage.setItem('vaultDocuments', JSON.stringify(filtered));
      this.dispatchStorageEvent();
    } catch (error) {
      console.error('Error deleting document:', error);
      throw new Error('Failed to delete document');
    }
  },

  dispatchStorageEvent() {
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'vaultDocuments',
        newValue: localStorage.getItem('vaultDocuments')
      }));
    } catch (error) {
      console.error('Error dispatching storage event:', error);
    }
  }
}; 