import { db } from '../db';
import { contractTemplates } from '@shared/schema';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI();

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

async function generateTemplate(category: string) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: "You are a legal document expert. Generate a contract template with all necessary components."
      }, {
        role: "user",
        content: `Generate a contract template for category: ${category}
        Include:
        1. Template name
        2. Description
        3. Content with variable placeholders in [VARIABLE_NAME] format
        4. Required variables with descriptions
        5. Tags
        6. Use case
        7. Complexity level (LOW, MEDIUM, HIGH)
        8. Recommended clauses
        9. Whether it's industry specific
        10. Jurisdiction

        Format as JSON with these exact keys:
        {
          name: string,
          description: string,
          content: string,
          metadata: {
            variables: Array<{name: string, description: string, required: boolean, type: string}>,
            tags: string[],
            useCase: string,
            complexity: "LOW" | "MEDIUM" | "HIGH",
            recommendedClauses: string[],
            industrySpecific: boolean,
            jurisdiction: string,
            aiAssistanceLevel: string
          }
        }`
      }],
      response_format: { type: "json_object" }
    });

    const template = JSON.parse(completion.choices[0].message.content);
    return {
      ...template,
      category,
      metadata: {
        ...template.metadata,
        lastUpdated: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error(`Failed to generate template for ${category}:`, error);
    throw error;
  }
}

export async function seedContractTemplates() {
  try {
    console.log("Starting contract templates seeding process...");

    // Clear existing templates
    await db.delete(contractTemplates);
    console.log("Cleared existing templates");

    const categories = [
      "NDA",
      "EMPLOYMENT",
      "REAL_ESTATE",
      "BUSINESS",
      "INTELLECTUAL_PROPERTY",
      "SERVICE_AGREEMENT"
    ];

    console.log("Generating AI-powered templates...");
    const templates = await Promise.all(
      categories.map(category => generateTemplate(category))
    );

    console.log(`Attempting to seed ${templates.length} templates...`);

    // Insert templates
    await db.insert(contractTemplates).values(templates);

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