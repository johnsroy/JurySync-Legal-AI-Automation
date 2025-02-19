import { openai } from "../openai";
import { db } from "../db";
import { contractTemplates } from "@shared/schema";

const TEMPLATE_CATEGORIES = [
  "EMPLOYMENT",
  "NDA",
  "SERVICE_AGREEMENT",
  "LICENSE_AGREEMENT",
  "SALES_AGREEMENT",
  "PARTNERSHIP_AGREEMENT",
  "CONSULTING_AGREEMENT",
  "LEASE_AGREEMENT",
  "LOAN_AGREEMENT",
  "PURCHASE_AGREEMENT",
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
  "PROFESSIONAL_SERVICES",
] as const;

interface TemplateGenRequest {
  category: typeof TEMPLATE_CATEGORIES[number];
  industry: typeof INDUSTRIES[number];
  complexity: "LOW" | "MEDIUM" | "HIGH";
}

export async function generateContractTemplate(request: TemplateGenRequest) {
  try {
    const prompt = `Generate a detailed ${request.category} contract template for the ${request.industry} industry. 
    The complexity level should be ${request.complexity}.
    
    Provide the response in the following JSON format:
    {
      "name": "Contract name",
      "description": "Brief description",
      "content": "Full contract text with proper sections and clauses",
      "metadata": {
        "useCase": "When to use this template",
        "keyProvisions": ["List of key provisions"],
        "risks": ["Potential risks to consider"],
        "tags": ["Relevant tags"]
      }
    }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using the latest model as per instructions
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const template = JSON.parse(response.choices[0].message.content);

    // Insert into database
    const [savedTemplate] = await db.insert(contractTemplates).values({
      name: template.name,
      category: request.category,
      description: template.description,
      content: template.content,
      metadata: template.metadata,
      industry: request.industry,
      complexity: request.complexity,
      jurisdiction: "USA", // Default jurisdiction
      created_at: new Date(),
      updated_at: new Date()
    }).returning();

    return savedTemplate;
  } catch (error) {
    console.error("Failed to generate contract template:", error);
    throw error;
  }
}

export async function generateAllTemplates() {
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

  // Generate templates in parallel, but in smaller batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < templates.length; i += batchSize) {
    const batch = templates.slice(i, i + batchSize);
    await Promise.all(batch.map(template => generateContractTemplate(template)));
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
