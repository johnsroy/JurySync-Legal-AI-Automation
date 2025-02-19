import { openai } from "../openai";
import { db } from "../db";
import { contractTemplates, type ContractTemplate, TemplateCategory } from "@shared/schema";
import { eq } from "drizzle-orm";

const TEMPLATE_CATEGORIES = [
  "EMPLOYMENT",
  "NDA", 
  "SERVICE_AGREEMENT",
  "LOAN_AGREEMENT",
  "REAL_ESTATE",
  "LEASE",
  "GENERAL",
  "SALES",
  "PARTNERSHIP",
  "CONSULTING"
] as const;

const INDUSTRIES = [
  "TECHNOLOGY",
  "HEALTHCARE",
  "FINANCE",
  "REAL_ESTATE",
  "MANUFACTURING",
  "RETAIL",
  "EDUCATION",
  "ENTERTAINMENT",
  "CONSTRUCTION",
  "PROFESSIONAL_SERVICES"
] as const;

interface TemplateGenRequest {
  category: typeof TEMPLATE_CATEGORIES[number];
  industry: typeof INDUSTRIES[number];
  complexity: "LOW" | "MEDIUM" | "HIGH";
}

async function generateTemplateMetadata() {
  return {
    description: "",
    tags: [],
    useCase: "",
    complexity: "MEDIUM" as const,
    recommendedClauses: [],
    variables: [],
    sampleValues: {},
    relatedTemplates: [],
    industrySpecific: false,
    lastUpdated: new Date().toISOString(),
    version: "1.0",
    aiAssistanceLevel: "ADVANCED" as const
  };
}

export async function generateContractTemplate(request: TemplateGenRequest): Promise<ContractTemplate> {
  try {
    console.log("[Template Generator] Generating template for:", {
      category: request.category,
      industry: request.industry,
      complexity: request.complexity
    });

    const prompt = `Generate a detailed ${request.category} contract template for the ${request.industry} industry. 
    The complexity level should be ${request.complexity}.

    The template should include:
    1. A clear title/name for the contract
    2. Detailed content with proper legal clauses
    3. Brief description of the template's purpose
    4. Key variables that need to be customized (marked with <<VARIABLE>>)

    Please format your response as a JSON object with these fields:
    {
      "name": "Contract name",
      "content": "Full contract text with proper sections and clauses",
      "description": "Brief description of what this contract is used for",
      "variables": ["List of variable names found in content"]
    }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using the latest model
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("OpenAI response content is empty");
    }

    const template = JSON.parse(content);
    console.log("[Template Generator] Successfully generated template:", template.name);

    // Generate metadata with default values
    const metadata = await generateTemplateMetadata();

    // Insert into database with proper type matching
    const [savedTemplate] = await db.insert(contractTemplates).values({
      name: template.name,
      category: request.category as TemplateCategory,
      content: template.content,
      metadata: {
        ...metadata,
        description: template.description,
        variables: template.variables.map(name => ({
          name,
          type: "TEXT",
          description: "Please fill in appropriate value",
          required: true
        }))
      },
      industry: request.industry,
      complexity: request.complexity,
      subcategory: null,
      jurisdiction: "USA",
      estimatedCompletionTime: "30-60 minutes",
      popularityScore: 0,
      created_at: new Date(),
      updated_at: new Date()
    }).returning();

    console.log("[Template Generator] Saved template to database with ID:", savedTemplate.id);
    return savedTemplate;

  } catch (error) {
    console.error("[Template Generator] Failed to generate contract template:", error);
    throw error;
  }
}

export async function generateAllTemplates() {
  console.log("[Template Generator] Starting bulk template generation");
  const templates: TemplateGenRequest[] = [];

  // Generate a diverse mix of templates
  for (const category of TEMPLATE_CATEGORIES) {
    for (const industry of INDUSTRIES) {
      const complexities = ["LOW", "MEDIUM", "HIGH"] as const;
      for (const complexity of complexities) {
        // Only generate some combinations to get 50 templates
        if (Math.random() < 0.5) {
          templates.push({
            category,
            industry,
            complexity
          });
        }
      }
    }
  }

  // Ensure we have at least 50 templates
  while (templates.length < 50) {
    const category = TEMPLATE_CATEGORIES[Math.floor(Math.random() * TEMPLATE_CATEGORIES.length)];
    const industry = INDUSTRIES[Math.floor(Math.random() * INDUSTRIES.length)];
    const complexity = ["LOW", "MEDIUM", "HIGH"][Math.floor(Math.random() * 3)] as "LOW" | "MEDIUM" | "HIGH";

    templates.push({ category, industry, complexity });
  }

  console.log(`[Template Generator] Prepared ${templates.length} template configurations`);

  // First clear existing templates
  const count = await db.delete(contractTemplates).execute();
  console.log("[Template Generator] Cleared existing templates:", count);

  // Generate templates in parallel, but in smaller batches to avoid rate limits
  const batchSize = 5;
  let successCount = 0;

  for (let i = 0; i < templates.length; i += batchSize) {
    try {
      const batch = templates.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(template => generateContractTemplate(template)));
      successCount += results.length;
      console.log(`[Template Generator] Completed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(templates.length/batchSize)}, total success: ${successCount}`);

      // Small delay between batches to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[Template Generator] Error in batch starting at index ${i}:`, error);
      // Continue with next batch despite errors
    }
  }

  console.log(`[Template Generator] Generation complete. Successfully generated ${successCount} templates`);
  return successCount;
}