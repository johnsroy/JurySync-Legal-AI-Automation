import { db } from '../db';
import { legalDocuments } from '@shared/schema';
import { faker } from '@faker-js/faker';

// Function to generate random dates within a range
const randomDate = (start: Date, end: Date) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Additional state constitutional law cases
const generateStateCases = (count: number) => Array.from({ length: count }, (_, index) => ({
  title: `State v. ${faker.company.name()}`,
  content: `${faker.lorem.paragraphs(3)} Case number: SC-${2024 + Math.floor(index/12)}-${100 + index}

    Key Constitutional Issues:
    1. ${faker.lorem.sentence()}
    2. ${faker.lorem.sentence()}
    3. ${faker.lorem.sentence()}

    Legal Analysis:
    ${faker.lorem.paragraphs(2)}

    Precedent Impact:
    ${faker.lorem.paragraph()}`,
  documentType: "CASE_LAW",
  jurisdiction: "State",
  legalTopic: "Constitutional",
  date: randomDate(new Date('2024-11-01'), new Date('2025-02-15')),
  status: "ACTIVE",
  metadata: {
    court: "State Supreme Court",
    citation: `${2024 + Math.floor(index/12)} S.Ct. ${100 + index}`
  },
  citations: []
}));

// State constitutional statutes
const generateStateStatutes = (count: number) => Array.from({ length: count }, (_, index) => ({
  title: `State ${faker.company.name()} Constitutional Rights Act of ${2024 + Math.floor(index/12)}`,
  content: `
    WHEREAS, the protection of constitutional rights is paramount to the functioning of our state;

    Section 1. Purpose
    ${faker.lorem.paragraphs(1)}

    Section 2. Definitions
    ${faker.lorem.paragraphs(1)}

    Section 3. Constitutional Protections
    ${faker.lorem.paragraphs(2)}

    Section 4. Implementation
    ${faker.lorem.paragraphs(1)}

    Section 5. Enforcement
    ${faker.lorem.paragraphs(1)}`,
  documentType: "STATUTE",
  jurisdiction: "State",
  legalTopic: "Constitutional",
  date: randomDate(new Date('2024-11-01'), new Date('2025-02-15')),
  status: "ACTIVE",
  metadata: {
    type: "State Statute",
    citation: `S.B. ${2024}-${200 + index}`
  },
  citations: []
}));

// State constitutional guidance documents
const generateStateGuidance = (count: number) => Array.from({ length: count }, (_, index) => ({
  title: `Guidelines on ${faker.company.name()} Constitutional Compliance`,
  content: `
    Executive Summary:
    ${faker.lorem.paragraph()}

    I. Background
    ${faker.lorem.paragraphs(1)}

    II. Scope of Application
    ${faker.lorem.paragraphs(1)}

    III. Constitutional Requirements
    ${faker.lorem.paragraphs(2)}

    IV. Implementation Guidelines
    ${faker.lorem.paragraphs(1)}

    V. Compliance Measures
    ${faker.lorem.paragraphs(1)}`,
  documentType: "GUIDANCE",
  jurisdiction: "State",
  legalTopic: "Constitutional",
  date: randomDate(new Date('2024-11-01'), new Date('2025-02-15')),
  status: "ACTIVE",
  metadata: {
    type: "State Regulatory Guidance",
    agency: "State Constitutional Rights Commission"
  },
  citations: []
}));

export async function seedLegalDatabase(numberOfDocuments: number = 500) {
  try {
    // Check if data already exists
    const existingDocs = await db.select().from(legalDocuments).limit(1);
    if (existingDocs.length > 0) {
      console.log("Legal Documents already seeded. Clearing existing data...");
      await db.delete(legalDocuments);
    }

    console.log(`Seeding Legal Documents...`);

    // Generate documents with a good mix of different types
    const allDocuments = [
      ...generateStateCases(Math.floor(numberOfDocuments * 0.5)), // 50% cases
      ...generateStateStatutes(Math.floor(numberOfDocuments * 0.3)), // 30% statutes
      ...generateStateGuidance(Math.floor(numberOfDocuments * 0.2)) // 20% guidance
    ];

    // Insert documents in batches
    const batchSize = 50;
    for (let i = 0; i < allDocuments.length; i += batchSize) {
      const batch = allDocuments.slice(i, i + batchSize);
      await db.insert(legalDocuments).values(batch);
      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(allDocuments.length/batchSize)}`);
    }

    console.log(`Seeded ${allDocuments.length} Legal Documents successfully.`);
  } catch (error) {
    console.error("Error seeding legal documents:", error);
    throw error;
  }
}