import { db } from '../db';
import { templateGenerator } from './template-generator';
import { TemplateCategory, TemplateCategoryEnum } from '@shared/schema/template-categories';
import { contractTemplates } from '@shared/schema';
import { sql } from 'drizzle-orm';

const TEMPLATES_PER_CATEGORY: Record<TemplateCategory, number> = {
  GENERAL: 5,
  EMPLOYMENT: 5,
  REAL_ESTATE: 5,
  BUSINESS: 5,
  INTELLECTUAL_PROPERTY: 5,
  SERVICE_AGREEMENT: 5,
  NDA: 5,
  LICENSING: 5,
  PARTNERSHIP: 4,
  CONSULTING: 3,
  MERGER_ACQUISITION: 3
};

const SPECIALIZATIONS: Record<TemplateCategory, string[]> = {
  EMPLOYMENT: ['Executive', 'Entry-level', 'Contractor', 'Remote Work', 'Commission-based'],
  REAL_ESTATE: ['Commercial Lease', 'Residential Sale', 'Property Management', 'Construction', 'Development'],
  BUSINESS: ['Partnership', 'Joint Venture', 'Franchise', 'Distribution', 'Supply'],
  INTELLECTUAL_PROPERTY: ['Software License', 'Patent', 'Trademark', 'Copyright', 'Trade Secret'],
  SERVICE_AGREEMENT: ['IT Services', 'Consulting', 'Marketing', 'Maintenance', 'Professional Services'],
  NDA: ['Mutual', 'Unilateral', 'Employee', 'Contractor', 'Vendor'],
  LICENSING: ['Software', 'Technology', 'Brand', 'Content', 'Patent'],
  PARTNERSHIP: ['General', 'Limited', 'Joint Venture', 'Strategic Alliance'],
  CONSULTING: ['Technology', 'Management', 'Financial'],
  MERGER_ACQUISITION: ['Asset Purchase', 'Stock Purchase', 'Merger'],
  GENERAL: ['General Purpose', 'Standard Terms', 'Basic Agreement', 'Simple Contract', 'Framework Agreement']
};

export async function seedContractTemplates() {
  try {
    console.log("Checking existing contract templates...");

    // Check if templates already exist
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contractTemplates);

    console.log(`Found ${count} existing templates`);

    if (count > 0) {
      console.log("Contract templates already seeded");
      return;
    }

    console.log("Starting contract template seeding...");

    const templates = [];
    const categories = Object.values(TemplateCategoryEnum.Values);

    for (const category of categories) {
      const numTemplates = TEMPLATES_PER_CATEGORY[category];
      const specializations = SPECIALIZATIONS[category] || [];

      console.log(`Generating ${numTemplates} templates for category ${category}`);

      for (let i = 0; i < numTemplates; i++) {
        try {
          const template = await templateGenerator.generateTemplate(
            category,
            specializations[i] || undefined
          );
          templates.push(template);
          console.log(`Generated template for ${category} (${i + 1}/${numTemplates})`);
        } catch (error) {
          console.error(`Failed to generate template for ${category}:`, error);
          continue;
        }
      }
    }

    if (templates.length === 0) {
      throw new Error("No templates were generated successfully");
    }

    // Insert templates in batches
    const batchSize = 10;
    for (let i = 0; i < templates.length; i += batchSize) {
      const batch = templates.slice(i, i + batchSize);
      await db.insert(contractTemplates).values(batch);
      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(templates.length/batchSize)}`);
    }

    // Verify insertion
    const [{ finalCount }] = await db
      .select({ finalCount: sql<number>`count(*)::int` })
      .from(contractTemplates);

    console.log(`Successfully seeded ${finalCount} contract templates`);
  } catch (error) {
    console.error("Error seeding contract templates:", error);
    throw error;
  }
}