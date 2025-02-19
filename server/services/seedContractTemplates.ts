import { db } from '../db';
import { contractTemplates } from '@shared/schema';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { parsePdfTemplate } from './contract-automation-service';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI();

const LEGAL_SERVICES_TEMPLATE = {
  name: "Legal Services Agreement",
  description: "Professional legal services engagement agreement",
  category: "SERVICE_AGREEMENT",
  content: `LEGAL SERVICES AGREEMENT

This Legal Services Agreement (the "Agreement") is made effective as of [EFFECTIVE_DATE], by and between:

[LAW_FIRM_NAME], with its principal place of business at [FIRM_ADDRESS] ("Attorney" or "Firm")
and
[CLIENT_NAME], located at [CLIENT_ADDRESS] ("Client")

1. SCOPE OF SERVICES
The Client hereby engages the Firm and the Firm hereby agrees to provide legal services in connection with [MATTER_DESCRIPTION] ("Services").

2. FEES AND BILLING
2.1 The Firm's fees for the Services will be calculated at the following rates:
    - Partner: [PARTNER_RATE] per hour
    - Associate: [ASSOCIATE_RATE] per hour
    - Paralegal: [PARALEGAL_RATE] per hour

3. RETAINER
Client agrees to pay an initial retainer of [RETAINER_AMOUNT], to be held in the Firm's trust account.

4. EXPENSES
Client shall reimburse the Firm for all reasonable expenses incurred in providing the Services.

5. TERM AND TERMINATION
This Agreement shall commence on [START_DATE] and continue until [END_DATE] or until terminated by either party with written notice.

6. CONFIDENTIALITY
The Firm shall maintain strict confidentiality of all Client information and communications.

7. CONFLICTS OF INTEREST
The Firm has conducted a conflicts check and found no current conflicts of interest.

8. GOVERNING LAW
This Agreement shall be governed by the laws of [JURISDICTION].

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first above written.

[LAW_FIRM_NAME]
By: _____________________
Name: [ATTORNEY_NAME]
Title: [ATTORNEY_TITLE]

[CLIENT_NAME]
By: _____________________
Name: [CLIENT_SIGNER_NAME]
Title: [CLIENT_SIGNER_TITLE]`,
  metadata: {
    variables: [
      { name: "EFFECTIVE_DATE", description: "The effective date of the agreement", required: true, type: "date" },
      { name: "LAW_FIRM_NAME", description: "Legal name of the law firm", required: true, type: "text" },
      { name: "FIRM_ADDRESS", description: "Complete address of the law firm", required: true, type: "text" },
      { name: "CLIENT_NAME", description: "Legal name of the client", required: true, type: "text" },
      { name: "CLIENT_ADDRESS", description: "Complete address of the client", required: true, type: "text" },
      { name: "MATTER_DESCRIPTION", description: "Detailed description of legal services to be provided", required: true, type: "text" },
      { name: "PARTNER_RATE", description: "Hourly rate for partner services", required: true, type: "number" },
      { name: "ASSOCIATE_RATE", description: "Hourly rate for associate services", required: true, type: "number" },
      { name: "PARALEGAL_RATE", description: "Hourly rate for paralegal services", required: true, type: "number" },
      { name: "RETAINER_AMOUNT", description: "Initial retainer amount", required: true, type: "number" },
      { name: "START_DATE", description: "Start date of the agreement", required: true, type: "date" },
      { name: "END_DATE", description: "End date of the agreement", required: false, type: "date" },
      { name: "JURISDICTION", description: "Governing law jurisdiction", required: true, type: "text" },
      { name: "ATTORNEY_NAME", description: "Name of the signing attorney", required: true, type: "text" },
      { name: "ATTORNEY_TITLE", description: "Title of the signing attorney", required: true, type: "text" },
      { name: "CLIENT_SIGNER_NAME", description: "Name of the client's authorized signer", required: true, type: "text" },
      { name: "CLIENT_SIGNER_TITLE", description: "Title of the client's authorized signer", required: true, type: "text" }
    ],
    tags: ["legal services", "professional services", "attorney", "law firm"],
    useCase: "Engaging legal representation and defining scope of services",
    complexity: "HIGH",
    recommendedClauses: [
      "Scope of Services",
      "Fees and Billing",
      "Retainer",
      "Expenses",
      "Term and Termination",
      "Confidentiality",
      "Conflicts of Interest"
    ],
    industrySpecific: true,
    jurisdiction: "US",
    lastUpdated: new Date().toISOString(),
    aiAssistanceLevel: "EXPERT"
  }
};

async function generateTemplate(category: string) {
  try {
    // For service agreements, use our pre-defined template
    if (category === "SERVICE_AGREEMENT") {
      return LEGAL_SERVICES_TEMPLATE;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: "You are a legal document expert. Generate a detailed contract template with comprehensive components following the structure of our legal services agreement template."
      }, {
        role: "user",
        content: `Generate a professional contract template for category: ${category}
        Include:
        1. Template name
        2. Description
        3. Detailed content with proper sections and clauses
        4. Variable placeholders in [VARIABLE_NAME] format
        5. Required variables with descriptions
        6. Relevant tags
        7. Specific use case
        8. Complexity level (LOW, MEDIUM, HIGH)
        9. Recommended clauses
        10. Industry specificity
        11. Jurisdiction

        Format as JSON matching this structure:
        {
          name: string,
          description: string,
          content: string (include a properly formatted contract with sections),
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
      response_format: { type: "json_object" },
      max_tokens: 4000,
      temperature: 0.7
    });

    const template = JSON.parse(completion.choices[0].message.content || "{}");
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
      "SERVICE_AGREEMENT",
      "LICENSING",
      "PARTNERSHIP",
      "CONSULTING",
      "MERGER_ACQUISITION"
    ];

    console.log("Generating AI-powered templates...");
    const templates = await Promise.all(
      categories.map(category => generateTemplate(category))
    );

    console.log(`Attempting to seed ${templates.length} templates...`);

    // Insert templates with generated IDs
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