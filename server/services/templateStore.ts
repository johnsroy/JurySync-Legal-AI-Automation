import { z } from "zod";
import { TemplateCategory } from "@shared/schema";
import { anthropic } from '../anthropic';
import { openai } from '../openai';

// Initialize AI clients
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024

interface RequirementSuggestion {
  description: string;
  importance: "HIGH" | "MEDIUM" | "LOW";
  context: string;
}

export async function suggestRequirements(templateId: string, currentDescription?: string): Promise<RequirementSuggestion[]> {
  try {
    console.log(`[TemplateStore] Starting suggestion generation for template: ${templateId}`);

    const template = getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a legal contract assistant. Generate specific, practical requirements for contract templates.
          Return exactly 5 suggestions in JSON array format.`
        },
        {
          role: "user",
          content: `Generate 5 specific requirements for this contract template:
          Template: ${template.name}
          Description: ${template.description}
          Current Description: ${currentDescription || 'Not provided'}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Invalid response from AI');

    const suggestions = JSON.parse(content);
    return suggestions.suggestions;
  } catch (error) {
    console.error('[TemplateStore] Error generating suggestions:', error);
    throw error;
  }
}

export async function getCustomInstructionSuggestions(
  templateId: string,
  currentRequirements: string[]
): Promise<Array<{ instruction: string; explanation: string }>> {
  try {
    console.log(`[TemplateStore] Starting custom instruction generation for template: ${templateId}`);
    const template = getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a legal document assistant. Generate specific instructions for customizing contract templates.
          Return exactly 3 suggestions in JSON array format.`
        },
        {
          role: "user",
          content: `Generate 3 custom instruction suggestions for this contract template:
          Template: ${template.name}
          Description: ${template.description}
          Current Requirements: ${JSON.stringify(currentRequirements)}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Invalid response from AI');

    return JSON.parse(content).suggestions;
  } catch (error) {
    console.error('[TemplateStore] Error generating custom instructions:', error);
    throw error;
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a legal document assistant. Generate relevant completions for contract text.
          Return exactly 3 suggestions in JSON array format.`
        },
        {
          role: "user",
          content: `Given this partial text in a ${template.name}, suggest 3 relevant completions:
          Partial text: "${partialText}"
          Template context: ${template.description}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Invalid response from AI');

    return JSON.parse(content);
  } catch (error) {
    console.error('[TemplateStore] Error generating autocomplete:', error);
    throw error;
  }
}

// Schema for approval analysis
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

// All template definitions
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
  },
  "merger-acquisition-standard": {
    id: "merger-acquisition-standard",
    name: "Standard Merger & Acquisition Agreement",
    description: "Comprehensive agreement for standard merger and acquisition transactions",
    category: "PARTNERSHIP",
    baseContent: `
MERGER AND ACQUISITION AGREEMENT

This Merger and Acquisition Agreement (the "Agreement") is made and entered into as of [EFFECTIVE_DATE], by and between:

[ACQUIRING_COMPANY] ("Acquirer"), a corporation organized under the laws of [ACQUIRER_JURISDICTION]

and

[TARGET_COMPANY] ("Target"), a corporation organized under the laws of [TARGET_JURISDICTION]

1. THE MERGER
   1.1 The Merger. Upon the terms and subject to the conditions set forth in this Agreement, at the Effective Time, Target shall merge with and into Acquirer (the "Merger").
   1.2 Effective Time: [EFFECTIVE_TIME]
   1.3 Effects of the Merger: [MERGER_EFFECTS]

2. CONSIDERATION
   2.1 Merger Consideration: [MERGER_CONSIDERATION]
   2.2 Payment Terms: [PAYMENT_TERMS]
   2.3 Exchange Ratio: [EXCHANGE_RATIO]

3. REPRESENTATIONS AND WARRANTIES
   3.1 Target Representations: [TARGET_REPRESENTATIONS]
   3.2 Acquirer Representations: [ACQUIRER_REPRESENTATIONS]

4. CONDITIONS TO CLOSING
   4.1 Conditions: [CLOSING_CONDITIONS]
   4.2 Due Diligence: [DUE_DILIGENCE_TERMS]

5. COVENANTS
   5.1 Conduct of Business: [BUSINESS_CONDUCT]
   5.2 Regulatory Approvals: [REGULATORY_REQUIREMENTS]

6. TERMINATION
   6.1 Termination Rights: [TERMINATION_RIGHTS]
   6.2 Effect of Termination: [TERMINATION_EFFECTS]`,
    variables: [
      { name: "EFFECTIVE_DATE", description: "Date of agreement execution", required: true },
      { name: "ACQUIRING_COMPANY", description: "Legal name of acquiring company", required: true },
      { name: "TARGET_COMPANY", description: "Legal name of target company", required: true },
      { name: "MERGER_CONSIDERATION", description: "Total consideration for the merger", required: true },
      { name: "EXCHANGE_RATIO", description: "Share exchange ratio for stock consideration", required: true }
    ],
    metadata: {
      industry: "All",
      jurisdiction: "United States",
      lastUpdated: "2025-02-14"
    }
  },
  "asset-purchase-agreement": {
    id: "asset-purchase-agreement",
    name: "Asset Purchase Agreement",
    description: "Template for the purchase of specific assets or business units",
    category: "PARTNERSHIP",
    baseContent: `
ASSET PURCHASE AGREEMENT

This Asset Purchase Agreement (the "Agreement") is made as of [EFFECTIVE_DATE] between:

[SELLER_NAME] ("Seller")
and
[BUYER_NAME] ("Buyer")

1. ASSETS TO BE PURCHASED
   1.1 Purchased Assets: [PURCHASED_ASSETS]
   1.2 Excluded Assets: [EXCLUDED_ASSETS]

2. PURCHASE PRICE AND PAYMENT
   2.1 Purchase Price: [PURCHASE_PRICE]
   2.2 Payment Terms: [PAYMENT_TERMS]
   2.3 Adjustments: [PRICE_ADJUSTMENTS]

3. LIABILITIES
   3.1 Assumed Liabilities: [ASSUMED_LIABILITIES]
   3.2 Excluded Liabilities: [EXCLUDED_LIABILITIES]

4. REPRESENTATIONS AND WARRANTIES
   4.1 Seller's Representations: [SELLER_REPRESENTATIONS]
   4.2 Buyer's Representations: [BUYER_REPRESENTATIONS]

5. CLOSING CONDITIONS
   5.1 Due Diligence: [DUE_DILIGENCE]
   5.2 Required Approvals: [REQUIRED_APPROVALS]`,
    variables: [
      { name: "SELLER_NAME", description: "Legal name of the selling entity", required: true },
      { name: "BUYER_NAME", description: "Legal name of the buying entity", required: true },
      { name: "PURCHASED_ASSETS", description: "Detailed description of assets being purchased", required: true },
      { name: "PURCHASE_PRICE", description: "Total purchase price for the assets", required: true },
      { name: "PAYMENT_TERMS", description: "Terms and schedule of payment", required: true }
    ],
    metadata: {
      industry: "All",
      jurisdiction: "United States",
      lastUpdated: "2025-02-14"
    }
  },
  "stock-purchase-agreement": {
    id: "stock-purchase-agreement",
    name: "Stock Purchase Agreement",
    description: "Agreement for the purchase of company stock or equity interests",
    category: "PARTNERSHIP",
    baseContent: `
STOCK PURCHASE AGREEMENT

This Stock Purchase Agreement (the "Agreement") is made as of [EFFECTIVE_DATE] between:

[SELLER_NAME] ("Seller")
and
[PURCHASER_NAME] ("Purchaser")

1. STOCK PURCHASE
   1.1 Shares Being Sold: [SHARES_DESCRIPTION]
   1.2 Purchase Price: [SHARE_PRICE]
   1.3 Payment Method: [PAYMENT_METHOD]

2. REPRESENTATIONS AND WARRANTIES
   2.1 Seller's Representations: [SELLER_REPS]
   2.2 Company Representations: [COMPANY_REPS]
   2.3 Purchaser's Representations: [PURCHASER_REPS]

3. CLOSING CONDITIONS
   3.1 Conditions Precedent: [CONDITIONS_PRECEDENT]
   3.2 Closing Deliverables: [CLOSING_DELIVERABLES]

4. POST-CLOSING COVENANTS
   4.1 Non-Compete: [NON_COMPETE_TERMS]
   4.2 Transition Services: [TRANSITION_SERVICES]

5. INDEMNIFICATION
   5.1 Seller's Indemnification: [SELLER_INDEMNIFICATION]
   5.2 Purchaser's Indemnification: [PURCHASER_INDEMNIFICATION]`,
    variables: [
      { name: "SELLER_NAME", description: "Name of the selling shareholder(s)", required: true },
      { name: "PURCHASER_NAME", description: "Name of the stock purchaser", required: true },
      { name: "SHARES_DESCRIPTION", description: "Description of shares being sold", required: true },
      { name: "SHARE_PRICE", description: "Price per share or total price", required: true },
      { name: "CONDITIONS_PRECEDENT", description: "Conditions that must be met before closing", required: true }
    ],
    metadata: {
      industry: "All",
      jurisdiction: "United States",
      lastUpdated: "2025-02-14"
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

export async function generateContract(
  templateId: string,
  requirements: Array<{ description: string; importance: "HIGH" | "MEDIUM" | "LOW" }>,
  customInstructions?: string
): Promise<string> {
  try {
    console.log(`[TemplateStore] Generating contract for template: ${templateId}`);

    const template = getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2500,
      system: `You are an expert legal contract generator.
      Task: Enhance the provided contract template based on specific requirements while maintaining legal validity and clarity.

      Instructions:
      1. Use the base template as your foundation
      2. Incorporate all requirements based on their priority level
      3. Maintain professional legal language and formatting
      4. Ensure all critical template variables are properly addressed
      5. Add any necessary clauses based on the requirements
      6. If custom instructions are provided, adapt the contract accordingly while maintaining legal validity
      7. Return only the complete contract text`,
      messages: [{
        role: "user",
        content: `Generate a contract based on this template and requirements:

Template: ${template.name}
Base Content: ${template.baseContent}

Requirements (in order of importance):
${requirements.map(req => `[${req.importance}] ${req.description}`).join('\n')}

${customInstructions ? `\nCustom Instructions:\n${customInstructions}` : ''}

Required Variables:
${template.variables.filter(v => v.required).map(v => `- ${v.name}: ${v.description}`).join('\n')}

Return ONLY the generated contract text.`
      }]
    });

    const content = response.content[0];
    if (!content || !('text' in content)) {
      throw new Error('Invalid response format from AI');
    }

    console.log('[TemplateStore] Successfully generated contract');
    return content.text.trim();
  } catch (error) {
    console.error('[TemplateStore] Contract generation error:', error);
    throw new Error('Failed to generate contract: ' + (error instanceof Error ? error.message : String(error)));
  }
}

// Export template store functions
export const templateStore = {
  suggestRequirements,
  getCustomInstructionSuggestions,
  getAutocomplete,
  getTemplate,
  getAllTemplates,
  getTemplatesByCategory,
  generateContract
};