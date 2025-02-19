import { db } from '../db';
import { contractTemplates } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { templateStore } from './templateStore';

export async function seedContractTemplates() {
  try {
    console.log("Checking existing contract templates...");

    // Check if templates already exist
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contractTemplates);

    console.log(`Found ${count} existing templates`);

    // Clear existing templates
    await db.delete(contractTemplates);
    console.log("Cleared existing templates");

    console.log("Starting contract template seeding...");

    // Get templates from templateStore
    const templates = templateStore.getAllTemplates();

    if (templates.length === 0) {
      throw new Error("No templates available in templateStore");
    }

    console.log(`Seeding ${templates.length} templates from templateStore`);

    // Map templates to match exact database schema
    const dbTemplates = templates.map(template => ({
      name: template.name,
      description: template.description,
      category: template.category,
      content: template.baseContent,
      jurisdiction: template.metadata.jurisdiction || 'General',
      industry: template.metadata.industry || 'All',
      complexity: 'MEDIUM',
      subcategory: null, //Added Subcategory field
      metadata: {
        variables: template.variables,
        lastUpdated: template.metadata.lastUpdated,
        tags: []
      }
    }));

    // Insert templates in batches
    const batchSize = 20;
    for (let i = 0; i < dbTemplates.length; i += batchSize) {
      const batch = dbTemplates.slice(i, i + batchSize);
      await db.insert(contractTemplates).values(batch);
      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(dbTemplates.length/batchSize)}`);
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