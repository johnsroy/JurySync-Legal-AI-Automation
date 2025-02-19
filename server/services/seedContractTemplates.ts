import { db } from '../db';
import { contractTemplates } from '@shared/schema';
import { OpenAI } from 'openai';
import { TemplateCategory } from '@shared/schema';
import { sql } from 'drizzle-orm';

const openai = new OpenAI();

interface ContractTemplate {
  name: string;
  category: string;
  description: string;
  content: string;
  metadata: {
    variables: Array<{
      name: string;
      description: string;
      required: boolean;
      type: string;
      defaultValue?: string;
      validationRules?: string[];
    }>;
    tags: string[];
    useCase: string;
    complexity: "LOW" | "MEDIUM" | "HIGH";
    recommendedClauses: string[];
    industrySpecific: boolean;
    lastUpdated: string;
    version: string;
    aiAssistanceLevel: "BASIC" | "ADVANCED" | "EXPERT";
  };
  subcategory?: string;
  industry: string;
  jurisdiction: string;
  complexity: string;
  estimatedCompletionTime: string;
}

async function generateTemplateWithAI(category: string): Promise<ContractTemplate> {
  const prompt = `Generate a detailed contract template for the category: ${category}. 
  Include standard clauses, variables for customization, and metadata.
  Format as JSON with the following structure:
  {
    name: string,
    description: string,
    content: string (the actual contract template),
    metadata: {
      variables: Array of required fields,
      tags: relevant tags,
      useCase: primary use case,
      complexity: LOW/MEDIUM/HIGH,
      recommendedClauses: array of recommended clauses
    }
  }`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a legal contract expert generating detailed contract templates."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.7,
  });

  const generatedTemplate = JSON.parse(response.choices[0].message.content || "{}");

  return {
    ...generatedTemplate,
    category,
    industry: "General",
    jurisdiction: "United States",
    complexity: generatedTemplate.metadata.complexity || "MEDIUM",
    estimatedCompletionTime: "30 minutes",
  };
}

export async function seedContractTemplates() {
  try {
    console.log("Checking existing contract templates...");
    
    // Check if templates already exist using proper SQL count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contractTemplates);

    console.log(`Found ${count} existing templates`);

    if (count > 0) {
      console.log("Contract templates already seeded");
      return;
    }

    console.log("Starting contract template seeding...");

    // Define categories
    const categories = [
      "GENERAL",
      "EMPLOYMENT",
      "REAL_ESTATE",
      "BUSINESS",
      "INTELLECTUAL_PROPERTY",
      "SERVICE_AGREEMENT",
      "NDA",
      "LICENSING"
    ];

    const templates: ContractTemplate[] = [];

    for (const category of categories) {
      const numTemplates = category === "GENERAL" ? 5 : 2;
      
      for (let i = 0; i < numTemplates; i++) {
        try {
          const template = await generateTemplateWithAI(category);
          templates.push(template);
          console.log(`Generated template for ${category} (${i + 1}/${numTemplates})`);
        } catch (error) {
          console.error(`Failed to generate template for ${category}:`, error);
          // Continue with other templates even if one fails
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