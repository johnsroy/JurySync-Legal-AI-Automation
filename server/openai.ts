import OpenAI from "openai";
import type { AgentType, DocumentAnalysis } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

interface DocumentSection {
  title: string;
  content: string;
  level: number;
}

async function analyzeSection(section: DocumentSection, agentType: AgentType): Promise<DocumentAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a legal contract analysis expert. Analyze the given section and return a detailed JSON analysis focusing on contract elements, risks, and recommendations. Include:
            1. Key clauses and their implications
            2. Potential risks and gaps
            3. Standard compliance considerations
            4. Suggested improvements
            5. Overall risk assessment`
        },
        {
          role: "user",
          content: `Analyze this contract section titled "${section.title}":\n\n${section.content}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1000
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      console.error("Failed to parse OpenAI response:", content);
      throw new Error("Invalid JSON response from OpenAI");
    }
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}

export async function analyzeDocument(text: string, agentType: AgentType, sections: DocumentSection[] = []): Promise<DocumentAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  // If no sections provided, create one from the full text
  if (sections.length === 0) {
    sections = [{
      title: "Document Content",
      content: text,
      level: 1
    }];
  }

  console.log(`Starting contract analysis with ${sections.length} sections`);

  const results: DocumentAnalysis[] = [];
  for (const section of sections) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        console.log(`Processing section: ${section.title} (Attempt ${attempt + 1})`);
        const analysis = await analyzeSection(section, agentType);
        results.push(analysis);
        break;
      } catch (error) {
        if (attempt === MAX_RETRIES - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, INITIAL_RETRY_DELAY * Math.pow(2, attempt)));
      }
    }
  }

  return combineAnalysisResults(results);
}

function combineAnalysisResults(results: DocumentAnalysis[]): DocumentAnalysis {
  const combined: Required<DocumentAnalysis> = {
    summary: results.map(r => r.summary).join(" "),
    keyPoints: Array.from(new Set(results.flatMap(r => r.keyPoints))),
    suggestions: Array.from(new Set(results.flatMap(r => r.suggestions))),
    riskScore: Math.round(results.reduce((acc, r) => acc + r.riskScore, 0) / results.length),
    contractDetails: {
      parties: [],
      effectiveDate: "",
      termLength: "",
      keyObligations: [],
      terminationClauses: [],
      governingLaw: "",
      paymentTerms: "",
      disputeResolution: "",
      missingClauses: [],
      suggestedClauses: [],
      riskFactors: []
    }
  };

  // Merge contract details from all sections
  results.forEach(result => {
    if (result.contractDetails) {
      if (result.contractDetails.parties) combined.contractDetails.parties.push(...result.contractDetails.parties);
      if (result.contractDetails.keyObligations) combined.contractDetails.keyObligations.push(...result.contractDetails.keyObligations);
      if (result.contractDetails.terminationClauses) combined.contractDetails.terminationClauses.push(...result.contractDetails.terminationClauses);
      if (result.contractDetails.missingClauses) combined.contractDetails.missingClauses.push(...result.contractDetails.missingClauses);
      if (result.contractDetails.suggestedClauses) combined.contractDetails.suggestedClauses.push(...result.contractDetails.suggestedClauses);
      if (result.contractDetails.riskFactors) combined.contractDetails.riskFactors.push(...result.contractDetails.riskFactors);

      // Take the most recent non-empty values
      if (result.contractDetails.effectiveDate) {
        combined.contractDetails.effectiveDate = result.contractDetails.effectiveDate;
      }
      if (result.contractDetails.termLength) {
        combined.contractDetails.termLength = result.contractDetails.termLength;
      }
      if (result.contractDetails.governingLaw) {
        combined.contractDetails.governingLaw = result.contractDetails.governingLaw;
      }
      if (result.contractDetails.paymentTerms) {
        combined.contractDetails.paymentTerms = result.contractDetails.paymentTerms;
      }
      if (result.contractDetails.disputeResolution) {
        combined.contractDetails.disputeResolution = result.contractDetails.disputeResolution;
      }
    }
  });

  // Remove duplicates from arrays
  combined.contractDetails.parties = Array.from(new Set(combined.contractDetails.parties));
  combined.contractDetails.keyObligations = Array.from(new Set(combined.contractDetails.keyObligations));
  combined.contractDetails.terminationClauses = Array.from(new Set(combined.contractDetails.terminationClauses));
  combined.contractDetails.missingClauses = Array.from(new Set(combined.contractDetails.missingClauses));
  combined.contractDetails.suggestedClauses = Array.from(new Set(combined.contractDetails.suggestedClauses));
  combined.contractDetails.riskFactors = Array.from(new Set(combined.contractDetails.riskFactors));

  return combined;
}

export async function chatWithDocument(
  message: string,
  context: string,
  analysis: DocumentAnalysis
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a legal document assistant. Use the provided analysis to answer questions accurately and concisely.
Document Summary: ${analysis.summary}
Risk Score: ${analysis.riskScore}/10`
        },
        {
          role: "user",
          content: `Context: ${context.substring(0, 1500)}...
Question: ${message}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    return response.choices[0].message.content ||
           "I apologize, but I couldn't generate a response. Please try rephrasing your question.";
  } catch (error) {
    console.error('Error in chat:', error);
    throw new Error("Failed to process chat request");
  }
}