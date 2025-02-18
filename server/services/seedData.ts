import { db } from '../db';
import { legalDocuments } from '@shared/schema';
import { faker } from '@faker-js/faker';

// Function to generate random dates within a range
const randomDate = (start: Date, end: Date) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Generate comprehensive legal topics
const legalTopics = [
  "Constitutional",
  "Criminal",
  "Civil Rights",
  "Corporate",
  "Environmental",
  "Administrative",
  "Labor",
  "Tax",
  "Intellectual Property",
  "International"
];

// Additional jurisdictions
const jurisdictions = [
  "Federal",
  "State",
  "Supreme Court",
  "District Court",
  "Appellate Court"
];

// Generate diverse case law documents
const generateCaseLaw = (count: number) => Array.from({ length: count }, (_, index) => ({
  title: `${faker.company.name()} v. ${faker.company.name()}`,
  content: `${faker.lorem.paragraphs(3)}
    Case Citation: ${2024 + Math.floor(index/12)}-${100 + index}

    Key Legal Issues:
    1. ${faker.lorem.sentence()}
    2. ${faker.lorem.sentence()}
    3. ${faker.lorem.sentence()}

    Legal Analysis:
    ${faker.lorem.paragraphs(2)}

    Holdings:
    ${faker.lorem.paragraph()}

    Precedential Value:
    ${faker.lorem.paragraph()}`,
  documentType: "CASE_LAW",
  jurisdiction: jurisdictions[Math.floor(Math.random() * jurisdictions.length)],
  legalTopic: legalTopics[Math.floor(Math.random() * legalTopics.length)],
  date: randomDate(new Date('2024-11-01'), new Date('2025-02-15')),
  status: "ACTIVE",
  metadata: {
    court: jurisdictions[Math.floor(Math.random() * jurisdictions.length)],
    citation: `${2024 + Math.floor(index/12)} ${faker.helpers.arrayElement(['F.Supp.', 'U.S.', 'S.Ct.'])} ${100 + index}`,
    keyPrinciples: Array.from({length: 3}, () => faker.lorem.sentence())
  },
  citations: []
}));

// Generate statutes with broader coverage
const generateStatutes = (count: number) => Array.from({ length: count }, (_, index) => ({
  title: `${faker.helpers.arrayElement(['Revised', 'Amended', 'Updated'])} ${faker.company.name()} Act of ${2024 + Math.floor(index/12)}`,
  content: `
    SECTION 1. Purpose and Intent
    ${faker.lorem.paragraphs(1)}

    SECTION 2. Definitions
    ${faker.lorem.paragraphs(1)}

    SECTION 3. Substantive Provisions
    ${faker.lorem.paragraphs(2)}

    SECTION 4. Implementation
    ${faker.lorem.paragraphs(1)}

    SECTION 5. Enforcement
    ${faker.lorem.paragraphs(1)}

    SECTION 6. Effective Date
    This Act shall take effect on ${faker.date.future().toLocaleDateString()}.`,
  documentType: "STATUTE",
  jurisdiction: jurisdictions[Math.floor(Math.random() * jurisdictions.length)],
  legalTopic: legalTopics[Math.floor(Math.random() * legalTopics.length)],
  date: randomDate(new Date('2024-11-01'), new Date('2025-02-15')),
  status: "ACTIVE",
  metadata: {
    type: "Statute",
    citation: `Public Law ${2024}-${200 + index}`
  },
  citations: []
}));

// Generate regulatory guidance
const generateGuidance = (count: number) => Array.from({ length: count }, (_, index) => ({
  title: `Regulatory Guidance on ${faker.company.name()} Compliance`,
  content: `
    Executive Summary:
    ${faker.lorem.paragraph()}

    I. Background and Purpose
    ${faker.lorem.paragraphs(1)}

    II. Scope of Application
    ${faker.lorem.paragraphs(1)}

    III. Regulatory Requirements
    ${faker.lorem.paragraphs(2)}

    IV. Implementation Guidelines
    ${faker.lorem.paragraphs(1)}

    V. Best Practices
    ${faker.lorem.paragraphs(1)}`,
  documentType: "GUIDANCE",
  jurisdiction: jurisdictions[Math.floor(Math.random() * jurisdictions.length)],
  legalTopic: legalTopics[Math.floor(Math.random() * legalTopics.length)],
  date: randomDate(new Date('2024-11-01'), new Date('2025-02-15')),
  status: "ACTIVE",
  metadata: {
    type: "Regulatory Guidance",
    agency: faker.company.name()
  },
  citations: []
}));

export async function seedLegalDatabase(numberOfDocuments: number = 1000) {
  try {
    // Check if data already exists
    const existingDocs = await db.select().from(legalDocuments).limit(1);
    if (existingDocs.length > 0) {
      console.log("Legal Documents already seeded, skipping...");
      return;
    }

    console.log(`Seeding ${numberOfDocuments} Legal Documents...`);

    // Generate documents with a good mix of different types
    const allDocuments = [
      ...generateCaseLaw(Math.floor(numberOfDocuments * 0.4)), // 40% cases
      ...generateStatutes(Math.floor(numberOfDocuments * 0.3)), // 30% statutes
      ...generateGuidance(Math.floor(numberOfDocuments * 0.3)) // 30% guidance
    ];

    // Insert documents in smaller batches to prevent memory issues
    const batchSize = 25;
    for (let i = 0; i < allDocuments.length; i += batchSize) {
      const batch = allDocuments.slice(i, i + batchSize);
      await db.insert(legalDocuments).values(batch);
      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(allDocuments.length/batchSize)}`);

      // Add a small delay between batches to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Seeded ${allDocuments.length} Legal Documents successfully.`);
  } catch (error) {
    console.error("Error seeding legal documents:", error);
    throw error;
  }
}