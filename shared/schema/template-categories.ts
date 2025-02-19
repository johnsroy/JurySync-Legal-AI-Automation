import { z } from "zod";

// Define the template category enum
export const TemplateCategoryEnum = z.enum([
  "GENERAL",
  "EMPLOYMENT",
  "REAL_ESTATE", 
  "BUSINESS",
  "INTELLECTUAL_PROPERTY",
  "SERVICE_AGREEMENT",
  "NDA",
  "LICENSING",
  "PARTNERSHIP",
  "CONSULTING",
  "MERGER_ACQUISITION"
]);

export type TemplateCategory = z.infer<typeof TemplateCategoryEnum>;

// Schema for template metadata
export const templateMetadataSchema = z.object({
  variables: z.array(z.object({
    name: z.string(),
    description: z.string(),
    required: z.boolean(),
    type: z.string()
  })),
  tags: z.array(z.string()),
  useCase: z.string(),
  complexity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  recommendedClauses: z.array(z.string()),
  industrySpecific: z.boolean(),
  jurisdiction: z.string(),
  lastUpdated: z.string(),
  aiAssistanceLevel: z.string()
});

// Main template schema
export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: TemplateCategoryEnum,
  content: z.string(),
  metadata: templateMetadataSchema
});

export type Template = z.infer<typeof templateSchema>;
export type TemplateMetadata = z.infer<typeof templateMetadataSchema>;