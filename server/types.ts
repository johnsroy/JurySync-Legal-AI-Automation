export interface DocumentSection {
  title: string;
  content: string;
  level: number;
}

export interface ExtractedContent {
  text: string;
  sections: DocumentSection[];
  metadata: {
    title?: string;
    author?: string;
    creationDate?: string;
    lastModified?: string;
  };
}
