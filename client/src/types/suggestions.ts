import { TemplateCategory } from '@shared/schema/template-categories';

export interface FieldSuggestion {
  field: string;
  suggestions: string[];
  description: string;
  fieldType: 'date' | 'name' | 'address' | 'company' | 'amount' | 'other';
  selected?: boolean;
}

export interface SuggestionResponse {
  success: boolean;
  suggestions: FieldSuggestion[];
  error?: string;
}
