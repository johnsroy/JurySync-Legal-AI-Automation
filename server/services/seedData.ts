import { db } from '../db';
import { legalDocuments } from '@shared/schema';
import { legalResearchService } from './legalResearchService';
import { eq } from 'drizzle-orm';

// Expanded case law examples covering multiple jurisdictions and topics
const sampleCases = [
  {
    title: "Brown v. Board of Education",
    content: `347 U.S. 483 (1954). This landmark case overturned Plessy v. Ferguson and declared state laws establishing separate public schools for black and white students to be unconstitutional. The Supreme Court's unanimous decision stated that "separate educational facilities are inherently unequal."`,
    documentType: "CASE_LAW",
    jurisdiction: "United States",
    legalTopic: "Civil Rights",
    date: new Date("1954-05-17"),
    status: "ACTIVE",
    metadata: {
      court: "Supreme Court",
      citation: "347 U.S. 483"
    },
    citations: []
  },
  {
    title: "GDPR Implementation Case C-311/18",
    content: `Data Protection Commissioner v Facebook Ireland and Maximillian Schrems. This case addressed the transfer of personal data to third countries, particularly focusing on Standard Contractual Clauses (SCCs) and Privacy Shield framework.`,
    documentType: "CASE_LAW",
    jurisdiction: "European Union",
    legalTopic: "Privacy Law",
    date: new Date("2020-07-16"),
    status: "ACTIVE",
    metadata: {
      court: "Court of Justice of the European Union",
      citation: "C-311/18"
    },
    citations: []
  },
  {
    title: "R v Blockchain Technologies Ltd",
    content: `UK High Court ruling on the legal status of smart contracts and their enforceability under common law principles. The court established that smart contracts can form legally binding agreements.`,
    documentType: "CASE_LAW",
    jurisdiction: "United Kingdom",
    legalTopic: "Technology Law",
    date: new Date("2024-01-15"),
    status: "ACTIVE",
    metadata: {
      court: "High Court of Justice",
      citation: "EWHC 123"
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
    title: "General Data Protection Regulation (GDPR)",
    content: `Regulation (EU) 2016/679 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data. This comprehensive privacy and data protection framework sets standards for organizations handling EU residents' personal data.`,
    documentType: "STATUTE",
    jurisdiction: "European Union",
    legalTopic: "Privacy Law",
    date: new Date("2018-05-25"),
    status: "ACTIVE",
    metadata: {
      type: "EU Regulation",
      citation: "2016/679"
    },
    citations: []
  },
  {
    title: "California Consumer Privacy Act (CCPA)",
    content: `California Civil Code § 1798.100-1798.199. This landmark legislation enhances privacy rights and consumer protection for residents of California. It establishes requirements for businesses collecting and handling personal information.`,
    documentType: "STATUTE",
    jurisdiction: "United States",
    legalTopic: "Privacy Law",
    date: new Date("2020-01-01"),
    status: "ACTIVE",
    metadata: {
      type: "State Statute",
      citation: "Cal. Civ. Code § 1798.100"
    },
    citations: []
  },
  {
    title: "Digital Markets Act",
    content: `EU regulation aimed at ensuring fair competition in digital markets. It establishes obligations for large online platforms acting as gatekeepers in the digital sector.`,
    documentType: "STATUTE",
    jurisdiction: "European Union",
    legalTopic: "Technology Law",
    date: new Date("2023-05-02"),
    status: "ACTIVE",
    metadata: {
      type: "EU Regulation",
      citation: "DMA 2022/1925"
    },
    citations: []
  },
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

// Add regulatory guidance documents
const regulatoryGuidanceSamples = [
  {
    title: "SEC Guidance on Cryptocurrency Assets",
    content: `Regulatory framework for the treatment of digital assets and cryptocurrencies under securities laws. Provides guidance on token classification and registration requirements.`,
    documentType: "GUIDANCE",
    jurisdiction: "United States",
    legalTopic: "Financial Regulation",
    date: new Date("2024-01-10"),
    status: "ACTIVE",
    metadata: {
      type: "Regulatory Guidance",
      agency: "SEC"
    },
    citations: []
  }
];

export async function seedLegalDatabase() {
  try {
    console.log('Starting legal database seeding...');

    // Add documents to database and vector store
    const allDocuments = [...sampleCases, ...statuteSamples, ...regulatoryGuidanceSamples];

    for (const doc of allDocuments) {
      try {
        const [existingDoc] = await db
          .select()
          .from(legalDocuments)
          .where(eq(legalDocuments.title, doc.title))
          .limit(1);

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
        console.error(`Error processing legal document ${doc.title}:`, error);
      }
    }

    console.log('Legal database seeding completed');
  } catch (error) {
    console.error('Error in database seeding:', error);
  }
}