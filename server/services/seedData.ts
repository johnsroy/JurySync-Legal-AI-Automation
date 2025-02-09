import { db } from '../db';
import { legalDocuments, complianceDocuments } from '@shared/schema';
import { legalResearchService } from './legalResearchService';
import { eq } from 'drizzle-orm';

const sampleCases = [
  {
    title: "Brown v. Board of Education",
    content: `347 U.S. 483 (1954). This landmark case overturned Plessy v. Ferguson and declared state laws establishing separate public schools for black and white students to be unconstitutional. The Supreme Court's unanimous decision stated that "separate educational facilities are inherently unequal."`,
    documentType: "CASE_LAW",
    jurisdiction: "United States",
    date: new Date("1954-05-17"),
    status: "ACTIVE",
    metadata: {
      court: "Supreme Court",
      citation: "347 U.S. 483"
    },
    citations: []
  },
  {
    title: "Miranda v. Arizona",
    content: `384 U.S. 436 (1966). This decision established that prior to police interrogation, criminal suspects must be informed of their constitutional right to an attorney and against self-incrimination. The Supreme Court held that the Fifth Amendment requires law enforcement officials to advise suspects of their right to remain silent and to obtain an attorney during interrogation while in police custody.`,
    documentType: "CASE_LAW",
    jurisdiction: "United States",
    date: new Date("1966-06-13"),
    status: "ACTIVE",
    metadata: {
      court: "Supreme Court",
      citation: "384 U.S. 436"
    },
    citations: []
  },
  {
    title: "Roe v. Wade",
    content: `410 U.S. 113 (1973). The Court ruled that the Constitution protects a pregnant woman's liberty to choose to have an abortion without excessive government restriction. It struck down many federal and state abortion laws.`,
    documentType: "CASE_LAW",
    jurisdiction: "United States",
    date: new Date("1973-01-22"),
    status: "ACTIVE",
    metadata: {
      court: "Supreme Court",
      citation: "410 U.S. 113"
    },
    citations: []
  },
  {
    title: "Gideon v. Wainwright",
    content: `372 U.S. 335 (1963). The Supreme Court unanimously ruled that states are required under the Sixth Amendment of the Constitution to provide an attorney to defendants in criminal cases who are unable to afford their own attorneys.`,
    documentType: "CASE_LAW",
    jurisdiction: "United States",
    date: new Date("1963-03-18"),
    status: "ACTIVE",
    metadata: {
      court: "Supreme Court",
      citation: "372 U.S. 335"
    },
    citations: []
  },
  {
    title: "Marbury v. Madison",
    content: `5 U.S. 137 (1803). This case established the principle of judicial review in the United States, giving the Supreme Court the power to strike down laws as unconstitutional.`,
    documentType: "CASE_LAW",
    jurisdiction: "United States",
    date: new Date("1803-02-24"),
    status: "ACTIVE",
    metadata: {
      court: "Supreme Court",
      citation: "5 U.S. 137"
    },
    citations: []
  }
];

const statuteSamples = [
  {
    title: "Civil Rights Act of 1964",
    content: `This landmark civil rights and labor law outlaws discrimination based on race, color, religion, sex, national origin, and later sexual orientation and gender identity. It prohibits unequal application of voter registration requirements, racial segregation in schools and public accommodations, and employment discrimination.`,
    documentType: "STATUTE",
    jurisdiction: "United States",
    date: new Date("1964-07-02"),
    status: "ACTIVE",
    metadata: {
      type: "Federal Statute",
      publicLawNumber: "88-352"
    },
    citations: []
  },
  {
    title: "Americans with Disabilities Act of 1990",
    content: `A civil rights law that prohibits discrimination based on disability. It affords similar protections against discrimination to Americans with disabilities as the Civil Rights Act of 1964.`,
    documentType: "STATUTE",
    jurisdiction: "United States",
    date: new Date("1990-07-26"),
    status: "ACTIVE",
    metadata: {
      type: "Federal Statute",
      publicLawNumber: "101-336"
    },
    citations: []
  },
  {
    title: "Voting Rights Act of 1965",
    content: `This legislation prohibits racial discrimination in voting, outlaws discriminatory voting practices, and establishes federal oversight of election administration in states with a history of discriminatory voting practices.`,
    documentType: "STATUTE",
    jurisdiction: "United States",
    date: new Date("1965-08-06"),
    status: "ACTIVE",
    metadata: {
      type: "Federal Statute",
      publicLawNumber: "89-110"
    },
    citations: []
  }
];

const sampleComplianceDocuments = [
  {
    userId: 1, // Default admin user
    title: "Privacy Policy Compliance Report",
    content: `This document outlines our organization's privacy policy compliance with GDPR, CCPA, and other relevant data protection regulations. Key findings include data collection practices, storage security measures, and third-party data sharing agreements.`,
    documentType: "COMPLIANCE_REPORT",
    status: "MONITORING",
    riskScore: 75,
    lastScanned: new Date(),
    nextScanDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  },
  {
    userId: 1,
    title: "ISO 27001 Security Assessment",
    content: `Annual security assessment report detailing compliance with ISO 27001 standards. Covers information security policies, access control, cryptography, physical security, and operational security measures.`,
    documentType: "SECURITY_AUDIT",
    status: "MONITORING",
    riskScore: 85,
    lastScanned: new Date(),
    nextScanDue: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days from now
  },
  {
    userId: 1,
    title: "Employee Data Handling Guidelines",
    content: `Internal guidelines for proper handling of employee personal data. Includes protocols for data collection, storage, processing, and deletion in accordance with labor laws and privacy regulations.`,
    documentType: "INTERNAL_POLICY",
    status: "MONITORING",
    riskScore: 65,
    lastScanned: new Date(),
    nextScanDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  }
];

export async function seedComplianceDocuments() {
  try {
    console.log('Starting compliance documents seeding...');

    for (const doc of sampleComplianceDocuments) {
      try {
        // Check if document already exists by title
        const [existingDoc] = await db
          .select()
          .from(complianceDocuments)
          .where(eq(complianceDocuments.title, doc.title));

        if (!existingDoc) {
          await db
            .insert(complianceDocuments)
            .values(doc);
          console.log(`Added compliance document: ${doc.title}`);
        } else {
          console.log(`Compliance document already exists: ${doc.title}`);
        }
      } catch (error) {
        console.error(`Failed to add compliance document ${doc.title}:`, error);
        continue;
      }
    }

    console.log('Compliance documents seeding completed');
  } catch (error) {
    console.error('Failed to seed compliance documents:', error);
    throw error;
  }
}

export async function seedLegalDatabase() {
  try {
    console.log('Starting legal database seeding...');

    for (const doc of [...sampleCases, ...statuteSamples]) {
      try {
        const [existingDoc] = await db
          .select()
          .from(legalDocuments)
          .where(eq(legalDocuments.title, doc.title));

        if (!existingDoc) {
          const [insertedDoc] = await db
            .insert(legalDocuments)
            .values(doc)
            .returning();

          await legalResearchService.addDocument(insertedDoc);
          console.log(`Added document: ${doc.title}`);
        } else {
          console.log(`Document already exists: ${doc.title}`);
        }
      } catch (error) {
        console.error(`Failed to add document ${doc.title}:`, error);
        continue;
      }
    }

    await seedComplianceDocuments();

    console.log('Legal and compliance database seeding completed');
  } catch (error) {
    console.error('Failed to seed legal database:', error);
    throw error;
  }
}