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

    const sampleTemplates = [
      {
        name: "Non-Disclosure Agreement (NDA)",
        description: "Standard NDA template for protecting confidential information",
        category: "CONFIDENTIALITY",
        content: `This NON-DISCLOSURE AGREEMENT (the "Agreement") is made and entered into as of [DATE] by and between [PARTY A] and [PARTY B]...`,
        jurisdiction: "US",
        industry: "All",
        complexity: "MEDIUM",
        subcategory: "General NDA",
        metadata: {
          variables: [
            { name: "DATE", description: "Agreement effective date", required: true },
            { name: "PARTY_A", description: "First party name", required: true },
            { name: "PARTY_B", description: "Second party name", required: true }
          ],
          lastUpdated: new Date().toISOString(),
          tags: ["confidentiality", "business", "protection"]
        }
      },
      {
        name: "Employment Agreement",
        description: "Comprehensive employment contract template",
        category: "EMPLOYMENT",
        content: `EMPLOYMENT AGREEMENT made this [DATE] between [EMPLOYER] and [EMPLOYEE]...`,
        jurisdiction: "US",
        industry: "All",
        complexity: "HIGH",
        subcategory: "Full-Time Employment",
        metadata: {
          variables: [
            { name: "DATE", description: "Agreement start date", required: true },
            { name: "EMPLOYER", description: "Company name", required: true },
            { name: "EMPLOYEE", description: "Employee full name", required: true }
          ],
          lastUpdated: new Date().toISOString(),
          tags: ["employment", "hr", "contracts"]
        }
      },
      {
        name: "Software License Agreement",
        description: "Template for software licensing agreements",
        category: "LICENSING",
        content: `SOFTWARE LICENSE AGREEMENT between [LICENSOR] and [LICENSEE]...`,
        jurisdiction: "US",
        industry: "TECHNOLOGY",
        complexity: "HIGH",
        subcategory: "Software License",
        metadata: {
          variables: [
            { name: "LICENSOR", description: "Software owner", required: true },
            { name: "LICENSEE", description: "Software user", required: true }
          ],
          lastUpdated: new Date().toISOString(),
          tags: ["software", "licensing", "technology"]
        }
      }
    ];

    console.log(`Seeding ${sampleTemplates.length} templates`);

    // Insert templates in batches
    const batchSize = 3;
    for (let i = 0; i < sampleTemplates.length; i += batchSize) {
      const batch = sampleTemplates.slice(i, i + batchSize);
      await db.insert(contractTemplates).values(batch);
      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}`);
    }

    // Verify insertion
    const [{ finalCount }] = await db
      .select({ finalCount: sql<number>`count(*)::int` })
      .from(contractTemplates);

    console.log(`Successfully seeded ${finalCount} contract templates`);

    return finalCount;
  } catch (error) {
    console.error("Error seeding contract templates:", error);
    throw error;
  }
}