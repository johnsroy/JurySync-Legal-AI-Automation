import { db } from '../db';
import { legalDocuments } from '@shared/schema';
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

export async function seedLegalDatabase() {
  try {
    console.log('Starting legal database seeding...');

    // Insert documents into database and vector store
    for (const doc of [...sampleCases, ...statuteSamples]) {
      try {
        // Check if document already exists by title
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
        // Continue with next document even if one fails
        continue;
      }
    }

    console.log('Legal database seeding completed');
  } catch (error) {
    console.error('Failed to seed legal database:', error);
    throw error;
  }
}