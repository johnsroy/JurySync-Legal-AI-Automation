import { openai } from "../openai";
import { TemplateCategory, templateSchema } from "@shared/schema/template-categories";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
export class TemplateGenerator {
  async generateTemplate(category: TemplateCategory, specialization?: string): Promise<any> {
    try {
      const prompt = `Generate a detailed contract template for category: ${category}
      ${specialization ? `Specialization: ${specialization}` : ''}
      
      Return a JSON object with the following structure:
      {
        "name": "Template name",
        "description": "Detailed description",
        "category": "${category}",
        "baseContent": "Full contract template text with placeholders",
        "variables": [
          {
            "name": "VARIABLE_NAME",
            "description": "What this variable represents",
            "required": boolean,
            "type": "string"
          }
        ],
        "metadata": {
          "complexity": "LOW|MEDIUM|HIGH",
          "estimatedTime": "Estimated completion time",
          "industry": "Relevant industry",
          "jurisdiction": "Applicable jurisdiction",
          "popularityScore": number,
          "tags": ["relevant", "tags"],
          "useCase": "Primary use case",
          "recommendedClauses": ["Additional clauses to consider"]
        }
      }`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a legal document expert specializing in contract generation. Create detailed, professionally-structured contract templates."
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });

      const generatedTemplate = JSON.parse(response.choices[0].message.content);
      
      // Validate template against schema
      const validatedTemplate = templateSchema.parse({
        ...generatedTemplate,
        id: `${category.toLowerCase()}-${Date.now()}`,
        popularity: 0
      });

      return validatedTemplate;
    } catch (error) {
      console.error('Template generation error:', error);
      throw new Error(`Failed to generate template: ${error.message}`);
    }
  }
}

export const templateGenerator = new TemplateGenerator();
