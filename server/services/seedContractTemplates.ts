import { db } from '../db';
import { contractTemplates } from '@shared/schema';
import { sql } from 'drizzle-orm';

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
        content: `CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT

This Confidentiality and Non-Disclosure Agreement (the "Agreement") is made and entered into as of [DATE] by and between:

[PARTY A NAME], located at [PARTY A ADDRESS] ("Disclosing Party")
and
[PARTY B NAME], located at [PARTY B ADDRESS] ("Receiving Party")

1. Definition of Confidential Information...
2. Use of Confidential Information...
3. Term and Termination...`,
        metadata: {
          variables: [
            { name: "DATE", description: "Agreement effective date", required: true, type: "date" },
            { name: "PARTY A NAME", description: "First party full name", required: true, type: "text" },
            { name: "PARTY A ADDRESS", description: "First party address", required: true, type: "text" },
            { name: "PARTY B NAME", description: "Second party full name", required: true, type: "text" },
            { name: "PARTY B ADDRESS", description: "Second party address", required: true, type: "text" }
          ],
          tags: ["confidentiality", "business", "protection"],
          useCase: "Protecting confidential information in business relationships",
          complexity: "MEDIUM",
          recommendedClauses: ["Confidentiality", "Term", "Termination", "Return of Materials"],
          industrySpecific: false,
          jurisdiction: "US",
          lastUpdated: new Date().toISOString(),
          aiAssistanceLevel: "ADVANCED"
        }
      },
      {
        name: "Employment Agreement",
        description: "Comprehensive employment contract template",
        category: "EMPLOYMENT",
        content: `EMPLOYMENT AGREEMENT

This Employment Agreement (the "Agreement") is made and entered into on [DATE], by and between:

[COMPANY NAME], a corporation organized under the laws of [STATE] ("Employer")
and
[EMPLOYEE NAME] ("Employee")

1. Position and Duties...
2. Compensation...
3. Benefits...`,
        metadata: {
          variables: [
            { name: "DATE", description: "Agreement start date", required: true, type: "date" },
            { name: "COMPANY NAME", description: "Employer company name", required: true, type: "text" },
            { name: "STATE", description: "State of incorporation", required: true, type: "text" },
            { name: "EMPLOYEE NAME", description: "Employee full name", required: true, type: "text" }
          ],
          tags: ["employment", "hr", "contracts"],
          useCase: "Creating employment relationships",
          complexity: "HIGH",
          recommendedClauses: ["Compensation", "Benefits", "Termination", "Confidentiality"],
          industrySpecific: false,
          jurisdiction: "US",
          lastUpdated: new Date().toISOString(),
          aiAssistanceLevel: "EXPERT"
        }
      },
      {
        name: "Software License Agreement",
        description: "Enterprise software licensing agreement template",
        category: "LICENSING",
        content: `SOFTWARE LICENSE AGREEMENT

This Software License Agreement (the "Agreement") is made on [DATE] between:

[LICENSOR NAME] ("Licensor")
and
[LICENSEE NAME] ("Licensee")

1. License Grant...
2. Restrictions...
3. Term and Termination...`,
        metadata: {
          variables: [
            { name: "DATE", description: "Agreement date", required: true, type: "date" },
            { name: "LICENSOR NAME", description: "Software owner name", required: true, type: "text" },
            { name: "LICENSEE NAME", description: "Software user name", required: true, type: "text" }
          ],
          tags: ["software", "licensing", "technology"],
          useCase: "Software licensing and distribution",
          complexity: "HIGH",
          recommendedClauses: ["License Grant", "Restrictions", "Warranties", "Support"],
          industrySpecific: true,
          jurisdiction: "US",
          lastUpdated: new Date().toISOString(),
          aiAssistanceLevel: "EXPERT"
        }
      }
    ];

    console.log(`Seeding ${sampleTemplates.length} templates`);

    // Insert all templates at once
    await db.insert(contractTemplates).values(sampleTemplates);

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