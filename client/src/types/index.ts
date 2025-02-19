export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  baseContent: string;
  variables: Array<{
    name: string;
    description: string;
    required: boolean;
    type: string;
  }>;
  metadata: {
    complexity: "LOW" | "MEDIUM" | "HIGH";
    estimatedTime: string;
    industry?: string;
    jurisdiction?: string;
    popularityScore: number;
    tags: string[];
    useCase: string;
    recommendedClauses: string[];
  };
  popularity: number;
}

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  templates: Template[];
} 