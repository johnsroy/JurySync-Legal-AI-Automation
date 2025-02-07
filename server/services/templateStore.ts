import { documents } from "@shared/schema";

export interface ContractTemplate {
  id: string;
  name: string;
  type: string;
  baseContent: string;
  variables: string[];
  description: string;
}

// Pre-defined templates
export const contractTemplates: Record<string, ContractTemplate> = {
  EMPLOYMENT: {
    id: "employment-contract",
    name: "Employment Contract",
    type: "EMPLOYMENT",
    description: "Standard employment agreement template",
    variables: ["employeeName", "position", "startDate", "salary"],
    baseContent: `
EMPLOYMENT AGREEMENT

This Employment Agreement (the "Agreement") is made between [Company Name] ("Employer") and [Employee Name] ("Employee").

1. POSITION AND DUTIES
   The Employee will be employed as [Position] and will perform duties as assigned.

2. COMPENSATION
   The Employee will receive a salary of [Salary] per year.

3. TERM
   Employment will commence on [Start Date].

4. CONFIDENTIALITY
   The Employee agrees to maintain confidentiality of proprietary information.

5. TERMINATION
   Either party may terminate this agreement with written notice.
    `
  },
  NDA: {
    id: "nda-agreement",
    name: "Non-Disclosure Agreement",
    type: "NDA",
    description: "Confidentiality and non-disclosure agreement template",
    variables: ["partyNames", "purpose", "duration"],
    baseContent: `
CONFIDENTIALITY AGREEMENT

This Non-Disclosure Agreement (the "Agreement") is entered into between [Party Names].

1. CONFIDENTIAL INFORMATION
   The parties agree to maintain confidentiality of all proprietary information.

2. PURPOSE
   The purpose of disclosure is [Purpose].

3. DURATION
   This agreement will remain in effect for [Duration].

4. RETURN OF MATERIALS
   All confidential materials will be returned upon request.

5. GOVERNING LAW
   This agreement is governed by [Jurisdiction] law.
    `
  },
  SERVICE_AGREEMENT: {
    id: "service-agreement",
    name: "Service Agreement",
    type: "SERVICE_AGREEMENT",
    description: "Professional services agreement template",
    variables: ["serviceProvider", "client", "services", "fees"],
    baseContent: `
SERVICE AGREEMENT

This Service Agreement (the "Agreement") is between [Service Provider] and [Client].

1. SERVICES
   Provider will perform [Services] for Client.

2. COMPENSATION
   Client will pay [Fees] for services rendered.

3. TERM
   This agreement begins on [Start Date].

4. DELIVERABLES
   Provider will deliver specified items according to schedule.

5. TERMINATION
   Either party may terminate with notice.
    `
  }
};

export function getTemplate(type: string): ContractTemplate | undefined {
  return contractTemplates[type];
}

export function getAllTemplates(): ContractTemplate[] {
  return Object.values(contractTemplates);
}
