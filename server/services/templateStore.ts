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

// Expanded template store with more diverse templates
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
  "employment-executive": {
    id: "employment-executive",
    name: "Executive Employment Agreement",
    description: "Specialized employment agreement for C-level and executive positions",
    category: "EMPLOYMENT",
    baseContent: `EXECUTIVE EMPLOYMENT AGREEMENT

This Executive Employment Agreement (the "Agreement") is made and entered into as of [START_DATE], by and between:

[COMPANY_NAME] ("Company"), and
[EXECUTIVE_NAME] ("Executive")

1. POSITION AND DUTIES
   The Executive shall serve as [POSITION_TITLE] and shall have the duties and responsibilities commensurate with such position.

2. COMPENSATION AND BENEFITS
   2.1 Base Salary: [BASE_SALARY]
   2.2 Performance Bonus: [BONUS_STRUCTURE]
   2.3 Equity Compensation: [EQUITY_TERMS]
   2.4 Executive Benefits Package: [BENEFITS_PACKAGE]

3. TERM AND TERMINATION
   3.1 Term: [TERM_LENGTH]
   3.2 Severance: [SEVERANCE_TERMS]

4. NON-COMPETE AND CONFIDENTIALITY
   [NON_COMPETE_TERMS]`,
    variables: [
      { name: "EXECUTIVE_NAME", description: "Full name of the executive", required: true },
      { name: "POSITION_TITLE", description: "Executive position title", required: true },
      { name: "BASE_SALARY", description: "Annual base salary", required: true },
      { name: "BONUS_STRUCTURE", description: "Performance bonus terms", required: true },
      { name: "EQUITY_TERMS", description: "Stock options or equity compensation details", required: true }
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
  "nda-mutual": {
    id: "nda-mutual",
    name: "Mutual Non-Disclosure Agreement",
    description: "Bilateral NDA for mutual information exchange",
    category: "NDA",
    baseContent: `MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement (the "Agreement") is entered into as of [EFFECTIVE_DATE] between:

[PARTY_ONE_NAME] ("Party One") and
[PARTY_TWO_NAME] ("Party Two")

1. MUTUAL EXCHANGE
   Both parties agree to exchange confidential information for: [PURPOSE]

2. CONFIDENTIAL INFORMATION
   [CONFIDENTIAL_INFO_DEFINITION]

3. MUTUAL OBLIGATIONS
   Each party agrees to:
   a) Maintain strict confidentiality
   b) Use information only for [PERMITTED_USE]
   c) Implement security measures

4. TERM AND TERMINATION
   [DURATION] from the Effective Date`,
    variables: [
      { name: "PARTY_ONE_NAME", description: "Name of first party", required: true },
      { name: "PARTY_TWO_NAME", description: "Name of second party", required: true },
      { name: "PURPOSE", description: "Purpose of information exchange", required: true },
      { name: "PERMITTED_USE", description: "Allowed uses of confidential information", required: true }
    ],
    metadata: {
      industry: "All",
      jurisdiction: "United States",
      lastUpdated: "2025-02-07"
    }
  },
  "ip-license": {
    id: "ip-license",
    name: "Intellectual Property License Agreement",
    description: "License agreement for intellectual property rights",
    category: "IP_LICENSE",
    baseContent: `INTELLECTUAL PROPERTY LICENSE AGREEMENT

This License Agreement (the "Agreement") is made effective as of [EFFECTIVE_DATE] by and between:

[LICENSOR_NAME] ("Licensor") and
[LICENSEE_NAME] ("Licensee")

1. LICENSED IP
   [IP_DESCRIPTION]

2. GRANT OF RIGHTS
   2.1 Scope: [LICENSE_SCOPE]
   2.2 Territory: [TERRITORY]
   2.3 Term: [LICENSE_TERM]

3. ROYALTIES AND PAYMENTS
   [PAYMENT_TERMS]

4. OWNERSHIP AND IMPROVEMENTS
   [IP_OWNERSHIP_TERMS]`,
    variables: [
      { name: "LICENSOR_NAME", description: "Name of the IP owner", required: true },
      { name: "LICENSEE_NAME", description: "Name of the party receiving the license", required: true },
      { name: "IP_DESCRIPTION", description: "Description of the intellectual property", required: true },
      { name: "LICENSE_SCOPE", description: "Scope of the license grant", required: true },
      { name: "PAYMENT_TERMS", description: "Royalty and payment structure", required: true }
    ],
    metadata: {
      industry: "Technology",
      jurisdiction: "United States",
      lastUpdated: "2025-02-07"
    }
  },
  "saas-agreement": {
    id: "saas-agreement",
    name: "SaaS Subscription Agreement",
    description: "Software as a Service subscription agreement",
    category: "SERVICE_AGREEMENT",
    baseContent: `SOFTWARE AS A SERVICE AGREEMENT

This SaaS Agreement (the "Agreement") is entered into as of [EFFECTIVE_DATE] between:

[PROVIDER_NAME] ("Provider") and
[CUSTOMER_NAME] ("Customer")

1. SERVICES
   1.1 Description: [SERVICE_DESCRIPTION]
   1.2 Service Levels: [SLA_TERMS]

2. SUBSCRIPTION
   2.1 Term: [SUBSCRIPTION_TERM]
   2.2 Fees: [SUBSCRIPTION_FEES]

3. DATA PROTECTION
   [DATA_PROTECTION_TERMS]

4. SUPPORT AND MAINTENANCE
   [SUPPORT_TERMS]`,
    variables: [
      { name: "PROVIDER_NAME", description: "Name of the SaaS provider", required: true },
      { name: "CUSTOMER_NAME", description: "Name of the customer", required: true },
      { name: "SERVICE_DESCRIPTION", description: "Description of SaaS services", required: true },
      { name: "SUBSCRIPTION_FEES", description: "Pricing and payment terms", required: true },
      { name: "SLA_TERMS", description: "Service level agreement terms", required: true }
    ],
    metadata: {
      industry: "Technology",
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
  },
  "real-estate-lease": {
    id: "real-estate-lease",
    name: "Commercial Real Estate Lease",
    description: "Comprehensive commercial property lease agreement",
    category: "REAL_ESTATE",
    baseContent: `
COMMERCIAL LEASE AGREEMENT

This Commercial Lease Agreement (the "Lease") is made as of [EFFECTIVE_DATE] by and between:

[LANDLORD_NAME] ("Landlord") and
[TENANT_NAME] ("Tenant")

1. PREMISES
   Property Address: [PROPERTY_ADDRESS]
   Square Footage: [SQUARE_FOOTAGE]
   Permitted Use: [PERMITTED_USE]

2. LEASE TERM
   Commencement Date: [START_DATE]
   Termination Date: [END_DATE]

3. RENT AND EXPENSES
   Base Rent: [BASE_RENT]
   Security Deposit: [SECURITY_DEPOSIT]
   Additional Expenses: [ADDITIONAL_EXPENSES]

4. MAINTENANCE AND REPAIRS
   [MAINTENANCE_TERMS]

5. IMPROVEMENTS AND ALTERATIONS
   [IMPROVEMENT_TERMS]
`,
    variables: [
      { name: "LANDLORD_NAME", description: "Legal name of the property owner", required: true },
      { name: "TENANT_NAME", description: "Legal name of the tenant", required: true },
      { name: "PROPERTY_ADDRESS", description: "Full address of the leased property", required: true },
      { name: "BASE_RENT", description: "Monthly base rent amount", required: true }
    ],
    metadata: {
      industry: "Real Estate",
      jurisdiction: "United States",
      lastUpdated: "2025-02-07"
    }
  },

  "partnership-agreement": {
    id: "partnership-agreement",
    name: "General Partnership Agreement",
    description: "Formal partnership agreement for business ventures",
    category: "PARTNERSHIP",
    baseContent: `
PARTNERSHIP AGREEMENT

This Partnership Agreement (the "Agreement") is made on [EFFECTIVE_DATE] by and between:
[PARTNER_NAMES] (collectively, the "Partners")

1. PARTNERSHIP FORMATION
   Partnership Name: [PARTNERSHIP_NAME]
   Principal Place of Business: [BUSINESS_ADDRESS]
   Purpose: [PARTNERSHIP_PURPOSE]

2. CAPITAL CONTRIBUTIONS
   Initial Contributions: [CAPITAL_CONTRIBUTIONS]
   Profit/Loss Sharing: [PROFIT_SHARING]

3. MANAGEMENT
   Management Structure: [MANAGEMENT_STRUCTURE]
   Voting Rights: [VOTING_RIGHTS]

4. DISSOLUTION
   Dissolution Terms: [DISSOLUTION_TERMS]
`,
    variables: [
      { name: "PARTNER_NAMES", description: "Names of all partners", required: true },
      { name: "PARTNERSHIP_NAME", description: "Legal name of the partnership", required: true },
      { name: "CAPITAL_CONTRIBUTIONS", description: "Initial capital contributions of each partner", required: true }
    ],
    metadata: {
      industry: "Business",
      jurisdiction: "United States",
      lastUpdated: "2025-02-07"
    }
  },

  "consulting-agreement": {
    id: "consulting-agreement",
    name: "Professional Consulting Agreement",
    description: "Agreement for professional consulting services",
    category: "CONSULTING",
    baseContent: `
CONSULTING SERVICES AGREEMENT

This Consulting Agreement is entered into on [EFFECTIVE_DATE] between:
[CONSULTANT_NAME] ("Consultant") and
[CLIENT_NAME] ("Client")

1. SERVICES
   Scope of Services: [SERVICE_SCOPE]
   Deliverables: [DELIVERABLES]

2. COMPENSATION
   Fee Structure: [FEE_STRUCTURE]
   Payment Schedule: [PAYMENT_SCHEDULE]

3. TERM AND TERMINATION
   Term: [AGREEMENT_TERM]
   Termination Conditions: [TERMINATION_CONDITIONS]

4. INTELLECTUAL PROPERTY
   [IP_TERMS]
`,
    variables: [
      { name: "CONSULTANT_NAME", description: "Name of the consultant or consulting firm", required: true },
      { name: "CLIENT_NAME", description: "Name of the client", required: true },
      { name: "SERVICE_SCOPE", description: "Detailed scope of consulting services", required: true }
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

interface Suggestion {
  id: string;
  text: string;
  category?: string;
}

export async function suggestRequirements(templateId: string, currentDescription?: string): Promise<Suggestion[]> {
  try {
    console.log(`[TemplateStore] Generating requirements suggestions for template: ${templateId}`);

    const template = getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Generate 5 specific requirement suggestions for this contract template.
        Each suggestion should be relevant to the template type and help complete the contract.

        Template Name: ${template.name}
        Template Description: ${template.description}
        Current Description: ${currentDescription || 'Not provided'}

        Format each suggestion as a JSON object with:
        {
          "id": "unique_string",
          "text": "detailed requirement text",
          "category": "relevant category"
        }

        Return an array of these objects.`
      }]
    });

    const content = response.content[0];
    if (!content || !('text' in content)) {
      throw new Error('Invalid response format from AI');
    }

    const suggestions = JSON.parse(content.text);
    console.log(`[TemplateStore] Generated ${suggestions.length} suggestions`);

    return suggestions;
  } catch (error) {
    console.error('[TemplateStore] Error generating suggestions:', error);
    throw new Error('Failed to generate suggestions');
  }
}

export async function getAutocomplete(templateId: string, partialText: string): Promise<{
  suggestions: Array<{ text: string; description?: string }>;
}> {
  try {
    console.log(`[TemplateStore] Generating autocomplete suggestions for: ${partialText}`);

    const template = getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `Given this partial text in a ${template.name}, suggest 3-5 relevant completions.
        Each suggestion should be formatted as a JSON object with:
        {
          "text": "completion text",
          "description": "brief explanation"
        }

        Partial text: "${partialText}"
        Template context: ${template.description}

        Return an array of these objects.`
      }]
    });

    const content = response.content[0];
    if (!content || !('text' in content)) {
      throw new Error('Invalid response format from AI');
    }

    const suggestions = JSON.parse(content.text);
    return { suggestions };
  } catch (error) {
    console.error('[TemplateStore] Error generating autocomplete:', error);
    throw new Error('Failed to generate autocomplete suggestions');
  }
}

export async function getCustomInstructionSuggestions(
  templateId: string,
  currentRequirements: string[]
): Promise<Array<{ instruction: string; explanation: string }>> {
  try {
    console.log(`[TemplateStore] Generating custom instruction suggestions for template: ${templateId}`);

    const template = getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Generate 3-5 custom instruction suggestions for this contract template.
        Consider the template type and current requirements when making suggestions.

        Template: ${template.name}
        Template Description: ${template.description}
        Current Requirements: ${JSON.stringify(currentRequirements)}

        Format each suggestion as a JSON object with:
        {
          "instruction": "specific instruction text",
          "explanation": "why this instruction is helpful"
        }

        Return an array of these objects.`
      }]
    });

    const content = response.content[0];
    if (!content || !('text' in content)) {
      throw new Error('Invalid response format from AI');
    }

    const suggestions = JSON.parse(content.text);
    console.log(`[TemplateStore] Generated ${suggestions.length} custom instruction suggestions`);

    return suggestions;
  } catch (error) {
    console.error('[TemplateStore] Error generating custom instructions:', error);
    throw new Error('Failed to generate custom instruction suggestions');
  }
}