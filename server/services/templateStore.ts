import { z } from "zod";
import { TemplateCategory } from "@shared/schema";

export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: TemplateCategory,
  baseContent: z.string(),
  variables: z.array(z.object({
    name: z.string(),
    description: z.string(),
    required: z.boolean()
  })),
  metadata: z.object({
    industry: z.string().optional(),
    jurisdiction: z.string().optional(),
    lastUpdated: z.string()
  })
});

export type Template = z.infer<typeof templateSchema>;

// Template store with pre-defined templates
const templates: Record<string, Template> = {
  "employment-standard": {
    id: "employment-standard",
    name: "Standard Employment Agreement",
    description: "A comprehensive employment contract suitable for most business contexts",
    category: "EMPLOYMENT",
    baseContent: `
EMPLOYMENT AGREEMENT

This Employment Agreement (the "Agreement") is entered into as of [START_DATE], by and between:

[COMPANY_NAME] ("Employer"), a company organized under the laws of [JURISDICTION], with its principal place of business at [COMPANY_ADDRESS]

and

[EMPLOYEE_NAME] ("Employee"), residing at [EMPLOYEE_ADDRESS].

1. POSITION AND DUTIES
   The Employee will be employed as [POSITION_TITLE]. The Employee's duties include: [JOB_DUTIES]

2. COMPENSATION
   Base Salary: [BASE_SALARY]
   Payment Schedule: [PAYMENT_SCHEDULE]
   Benefits: [BENEFITS_DESCRIPTION]

3. TERM AND TERMINATION
   Start Date: [START_DATE]
   Notice Period: [NOTICE_PERIOD]

4. CONFIDENTIALITY
   The Employee agrees to maintain the confidentiality of the Employer's proprietary information...`,
    variables: [
      { name: "START_DATE", description: "Employment start date", required: true },
      { name: "COMPANY_NAME", description: "Legal name of the employer", required: true },
      { name: "EMPLOYEE_NAME", description: "Full name of the employee", required: true },
      { name: "POSITION_TITLE", description: "Job title or position", required: true },
      { name: "BASE_SALARY", description: "Annual or monthly base salary", required: true }
    ],
    metadata: {
      industry: "All",
      jurisdiction: "United States",
      lastUpdated: "2025-02-07"
    }
  },
  "nda-standard": {
    id: "nda-standard",
    name: "Standard Non-Disclosure Agreement",
    description: "A comprehensive NDA for protecting confidential information",
    category: "NDA",
    baseContent: `
NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement (the "Agreement") is entered into as of [EFFECTIVE_DATE] between:

[DISCLOSING_PARTY] ("Disclosing Party")
and
[RECEIVING_PARTY] ("Receiving Party")

1. CONFIDENTIAL INFORMATION
   Definition: [CONFIDENTIAL_INFO_DEFINITION]

2. PURPOSE
   The Receiving Party shall use the Confidential Information only for: [PURPOSE]

3. TERM
   This Agreement shall remain in effect for: [DURATION]

4. PROTECTION OF CONFIDENTIAL INFORMATION
   The Receiving Party agrees to:
   a) Maintain the confidentiality of the Disclosing Party's Confidential Information
   b) Use reasonable care to prevent disclosure
   c) Notify the Disclosing Party of any unauthorized disclosure`,
    variables: [
      { name: "EFFECTIVE_DATE", description: "Agreement start date", required: true },
      { name: "DISCLOSING_PARTY", description: "Party sharing confidential information", required: true },
      { name: "RECEIVING_PARTY", description: "Party receiving confidential information", required: true },
      { name: "PURPOSE", description: "Purpose of sharing confidential information", required: true }
    ],
    metadata: {
      industry: "All",
      jurisdiction: "United States",
      lastUpdated: "2025-02-07"
    }
  },
  "service-agreement": {
    id: "service-agreement",
    name: "Professional Service Agreement",
    description: "Standard service agreement for professional services",
    category: "SERVICE_AGREEMENT",
    baseContent: `
SERVICE AGREEMENT

This Service Agreement (the "Agreement") is entered into as of [EFFECTIVE_DATE] between:

[SERVICE_PROVIDER] ("Provider")
and
[CLIENT_NAME] ("Client")

1. SERVICES
   The Provider agrees to provide the following services: [SERVICES_DESCRIPTION]

2. COMPENSATION
   2.1 Service Fees: [SERVICE_FEES]
   2.2 Payment Terms: [PAYMENT_TERMS]

3. TERM AND TERMINATION
   3.1 Term: [CONTRACT_TERM]
   3.2 Termination: [TERMINATION_TERMS]

4. DELIVERABLES
   The Provider shall deliver: [DELIVERABLES]

5. WARRANTIES
   The Provider warrants that: [WARRANTY_TERMS]`,
    variables: [
      { name: "EFFECTIVE_DATE", description: "Contract start date", required: true },
      { name: "SERVICE_PROVIDER", description: "Name of the service provider", required: true },
      { name: "CLIENT_NAME", description: "Name of the client", required: true },
      { name: "SERVICES_DESCRIPTION", description: "Detailed description of services", required: true },
      { name: "SERVICE_FEES", description: "Fee structure for services", required: true }
    ],
    metadata: {
      industry: "Professional Services",
      jurisdiction: "United States",
      lastUpdated: "2025-02-07"
    }
  }
};

export function getTemplate(id: string): Template | undefined {
  console.log(`[TemplateStore] Retrieving template: ${id}`);
  const template = templates[id];
  if (!template) {
    console.log(`[TemplateStore] Template ${id} not found`);
    return undefined;
  }
  console.log(`[TemplateStore] Retrieved template: ${template.name}`);
  return template;
}

export function getAllTemplates(): Template[] {
  console.log('[TemplateStore] Getting all templates');
  const allTemplates = Object.values(templates);
  console.log(`[TemplateStore] Returning ${allTemplates.length} templates`);
  return allTemplates;
}

export function getTemplatesByCategory(category: Template["category"]): Template[] {
  console.log(`[TemplateStore] Getting templates for category: ${category}`);
  const filtered = Object.values(templates).filter(template => template.category === category);
  console.log(`[TemplateStore] Found ${filtered.length} templates for category ${category}`);
  return filtered;
}