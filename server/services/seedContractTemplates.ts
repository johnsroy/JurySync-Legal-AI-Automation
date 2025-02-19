import { db } from '../db';
import { contractTemplates } from '@shared/schema';
import { sql } from 'drizzle-orm';

export async function seedContractTemplates() {
  try {
    console.log("Starting contract templates seeding process...");

    // Clear existing templates
    await db.delete(contractTemplates);
    console.log("Cleared existing templates");

    const sampleTemplates = [
      {
        name: "Non-Disclosure Agreement (NDA)",
        description: "Comprehensive NDA for protecting confidential information",
        category: "NDA",
        content: `CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT

This Agreement is made between [COMPANY_NAME] ("Disclosing Party") and [RECIPIENT_NAME] ("Receiving Party").

1. Confidential Information
2. Non-Disclosure Obligations
3. Term and Termination`,
        metadata: {
          variables: [
            { 
              name: "COMPANY_NAME", 
              description: "Name of the company disclosing information", 
              required: true, 
              type: "text" 
            },
            { 
              name: "RECIPIENT_NAME", 
              description: "Name of the party receiving confidential information", 
              required: true, 
              type: "text" 
            }
          ],
          tags: ["confidentiality", "business protection", "trade secrets"],
          useCase: "Protecting sensitive business information",
          complexity: "MEDIUM",
          recommendedClauses: ["Confidentiality", "Non-Disclosure", "Term"],
          industrySpecific: false,
          jurisdiction: "US",
          lastUpdated: new Date().toISOString(),
          aiAssistanceLevel: "ADVANCED"
        }
      },
      {
        name: "Employment Agreement",
        description: "Standard employment contract with key protections",
        category: "EMPLOYMENT",
        content: `EMPLOYMENT AGREEMENT

This Employment Agreement is made between [EMPLOYER_NAME] and [EMPLOYEE_NAME].

1. Position and Duties
2. Compensation and Benefits
3. Term and Termination`,
        metadata: {
          variables: [
            { 
              name: "EMPLOYER_NAME", 
              description: "Name of the employing company", 
              required: true, 
              type: "text" 
            },
            { 
              name: "EMPLOYEE_NAME", 
              description: "Name of the employee", 
              required: true, 
              type: "text" 
            }
          ],
          tags: ["employment", "labor law", "HR"],
          useCase: "Establishing employment relationships",
          complexity: "HIGH",
          recommendedClauses: ["Duties", "Compensation", "Benefits"],
          industrySpecific: false,
          jurisdiction: "US",
          lastUpdated: new Date().toISOString(),
          aiAssistanceLevel: "EXPERT"
        }
      }
    ];

    console.log(`Attempting to seed ${sampleTemplates.length} templates...`);

    // Insert templates
    await db.insert(contractTemplates).values(sampleTemplates);

    // Verify insertion
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contractTemplates);

    console.log(`Successfully seeded ${count} contract templates`);
    return count;
  } catch (error) {
    console.error("Error seeding contract templates:", error);
    throw error;
  }
}