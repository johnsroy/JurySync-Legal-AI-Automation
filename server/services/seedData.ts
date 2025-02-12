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

    // Add documents to database and vector store
    for (const doc of [...sampleCases, ...statuteSamples]) {
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


import { db } from '../db';
import { modelMetrics, workflowMetrics, aggregateMetrics } from '@shared/schema/metrics';
import { chromaStore } from './chromaStore';
import { eq } from 'drizzle-orm';

// Sample data for analytics
const sampleModelData = [
  {
    modelId: "claude-3-opus-20240229",
    taskType: "DOCUMENT_ANALYSIS",
    processingTimeMs: 1200,
    tokenCount: 1500,
    successRate: 0.95,
    costPerRequest: 0.12,
    errorRate: 0.05,
    metadata: {
      promptTokens: 500,
      completionTokens: 1000,
      totalCost: 0.12,
      capabilities: ["document_analysis", "legal_research"],
      performance: { accuracy: 0.95, latency: 1200 }
    }
  },
  {
    modelId: "gpt-4o",
    taskType: "COMPLIANCE",
    processingTimeMs: 800,
    tokenCount: 1200,
    successRate: 0.92,
    costPerRequest: 0.10,
    errorRate: 0.08,
    metadata: {
      promptTokens: 400,
      completionTokens: 800,
      totalCost: 0.10,
      capabilities: ["compliance_check", "risk_assessment"],
      performance: { accuracy: 0.92, latency: 800 }
    }
  },
  {
    modelId: "claude-3-sonnet-20240229",
    taskType: "RESEARCH",
    processingTimeMs: 1500,
    tokenCount: 2000,
    successRate: 0.88,
    costPerRequest: 0.08,
    errorRate: 0.12,
    metadata: {
      promptTokens: 800,
      completionTokens: 1200,
      totalCost: 0.08,
      capabilities: ["legal_research", "citation_analysis"],
      performance: { accuracy: 0.88, latency: 1500 }
    }
  }
];

const workflowTypes = ["CONTRACT_REVIEW", "COMPLIANCE_AUDIT", "LEGAL_RESEARCH"];

export async function seedAnalyticsData() {
  try {
    console.log('Starting analytics data seeding...');

    // Check if data already exists
    const existingData = await db
      .select()
      .from(modelMetrics)
      .limit(1);

    if (existingData.length > 0) {
      console.log('Analytics data already exists, skipping seeding');
      return;
    }

    // Seed model metrics data
    for (const modelData of sampleModelData) {
      // Create multiple entries over the past 7 days
      for (let i = 0; i < 20; i++) {
        const timestamp = new Date();
        timestamp.setDate(timestamp.getDate() - Math.floor(Math.random() * 7));

        await db.insert(modelMetrics).values({
          ...modelData,
          timestamp,
          processingTimeMs: modelData.processingTimeMs + Math.floor(Math.random() * 500),
          successRate: modelData.successRate + (Math.random() * 0.1 - 0.05),
          errorRate: modelData.errorRate + (Math.random() * 0.1 - 0.05),
        });

        // Store in ChromaDB for vector search
        await chromaStore.storeMetrics({
          modelId: modelData.modelId,
          metrics: [
            modelData.successRate,
            modelData.errorRate || 0,
            modelData.processingTimeMs / 1000,
            modelData.costPerRequest,
            modelData.tokenCount / 1000
          ],
          metadata: {
            ...modelData.metadata,
            timestamp: timestamp.toISOString()
          }
        });
      }
    }

    // Seed workflow metrics
    for (const workflowType of workflowTypes) {
      for (let i = 0; i < 15; i++) {
        const timestamp = new Date();
        timestamp.setDate(timestamp.getDate() - Math.floor(Math.random() * 7));

        await db.insert(workflowMetrics).values({
          workflowId: `wf_${Date.now()}_${i}`,
          workflowType,
          modelUsed: sampleModelData[Math.floor(Math.random() * sampleModelData.length)].modelId,
          totalSteps: 5,
          completedSteps: Math.floor(Math.random() * 2) + 3,
          processingTime: Math.floor(Math.random() * 2000) + 1000,
          successRate: 0.75 + Math.random() * 0.2,
          timestamp,
          metadata: {
            stepsBreakdown: { analysis: 2, review: 2, approval: 1 },
            automationRate: 0.7 + Math.random() * 0.2,
            costSavings: Math.floor(Math.random() * 30) + 20,
            performance: {
              accuracy: 0.85 + Math.random() * 0.1,
              efficiency: 0.8 + Math.random() * 0.15
            }
          }
        });
      }
    }

    console.log('Analytics data seeding completed successfully');
  } catch (error) {
    console.error('Error seeding analytics data:', error);
    throw error;
  }
}