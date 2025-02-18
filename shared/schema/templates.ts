import { z } from "zod";
import { pgEnum } from "drizzle-orm/pg-core";

// Template Categories
export const templateCategoryEnum = pgEnum('template_category', [
  'EMPLOYMENT',
  'NDA', 
  'IP_LICENSE',
  'SERVICE_AGREEMENT',
  'REAL_ESTATE',
  'PARTNERSHIP',
  'CONSULTING'
]);

// Create a Zod enum for runtime validation
export const TemplateCategoryEnum = z.enum([
  'EMPLOYMENT',
  'NDA',
  'IP_LICENSE',
  'SERVICE_AGREEMENT',
  'REAL_ESTATE',
  'PARTNERSHIP',
  'CONSULTING'
]);

export type TemplateCategory = z.infer<typeof TemplateCategoryEnum>;