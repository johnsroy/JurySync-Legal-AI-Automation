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
  complexity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  estimatedTime: z.string(),
  industry: z.string().optional(),
  jurisdiction: z.string().optional(),
  popularityScore: z.number(),
  tags: z.array(z.string()),
  useCase: z.string(),
  recommendedClauses: z.array(z.string())
});

// Schema for template variables
export const templateVariableSchema = z.object({
  name: z.string(),
  description: z.string(),
  required: z.boolean(),
  type: z.string(),
  defaultValue: z.string().optional(),
  validationRules: z.array(z.string()).optional()
});

// Main template schema
export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: TemplateCategoryEnum,
  subcategory: z.string().optional(),
  baseContent: z.string(),
  variables: z.array(templateVariableSchema),
  metadata: templateMetadataSchema,
  popularity: z.number().default(0)
});

export type Template = z.infer<typeof templateSchema>;
export type TemplateMetadata = z.infer<typeof templateMetadataSchema>;
export type TemplateVariable = z.infer<typeof templateVariableSchema>;
