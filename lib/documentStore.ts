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
      localStorage.setItem('vaultDocuments', JSON.stringify(documents));
      this.dispatchStorageEvent();
      return newDocument;
    } catch (error) {
      console.error('Error saving document:', error);
      throw new Error('Failed to save document');
    }
  },

  getDocuments(): VaultDocument[] {
    try {
      const stored = localStorage.getItem('vaultDocuments');
      if (!stored) return [];
      return JSON.parse(stored);
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