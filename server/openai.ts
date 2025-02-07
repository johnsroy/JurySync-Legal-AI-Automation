import OpenAI from "openai";
import type { AgentType, DocumentAnalysis } from "@shared/schema";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const MAX_CHUNK_LENGTH = 1500;
const MAX_CONCURRENT_REQUESTS = 2;

interface DocumentSection {
  title: string;
  content: string;
  level: number;
}

// Helper functions
async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getSystemPromptForAgent(agentType: AgentType) {
  const basePrompt = `You are a legal AI assistant. Analyze the provided text section and return a JSON object. Keep all responses concise and focused on key points. Ensure all arrays have at least one item.`;

  switch (agentType) {
    case "CONTRACT_AUTOMATION":
      return `${basePrompt} The text is structured in sections with titles. Pay special attention to section headers and their hierarchy. Return ONLY a JSON object with this structure:
{
  "summary": "2-3 sentence summary focusing on key sections",
  "keyPoints": ["point 1", "point 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "riskScore": number between 1-10,
  "contractDetails": {
    "parties": ["party 1"],
    "effectiveDate": "date",
    "termLength": "duration",
    "keyObligations": ["obligation with section reference"],
    "terminationClauses": ["clause with section reference"],
    "governingLaw": "jurisdiction",
    "paymentTerms": "terms",
    "disputeResolution": "method",
    "missingClauses": ["clause"],
    "suggestedClauses": ["clause"],
    "riskFactors": ["risk"]
  }
}`;

    case "COMPLIANCE_AUDITING":
      return `${basePrompt} Focus on regulatory compliance and audit requirements. Return ONLY a JSON object with this structure:
{
  "summary": "2-3 sentence summary focusing on compliance status",
  "keyPoints": ["point 1", "point 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "riskScore": number between 1-10,
  "complianceDetails": {
    "regulatoryFrameworks": ["framework 1"],
    "complianceStatus": "status summary",
    "violations": ["violation 1"],
    "requiredActions": ["action 1"],
    "deadlines": ["deadline 1"],
    "auditTrail": ["audit point 1"],
    "riskAreas": ["risk area 1"],
    "recommendedControls": ["control 1"]
  }
}`;

    case "LEGAL_RESEARCH":
      return `${basePrompt} Focus on legal research, precedents, and case law analysis. Return ONLY a JSON object with this structure:
{
  "summary": "2-3 sentence summary focusing on legal principles",
  "keyPoints": ["point 1", "point 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "riskScore": number between 1-10,
  "researchDetails": {
    "relevantCases": ["case 1"],
    "precedents": ["precedent 1"],
    "statutes": ["statute 1"],
    "legalPrinciples": ["principle 1"],
    "jurisdictions": ["jurisdiction 1"],
    "timelineSummary": "chronological summary",
    "argumentAnalysis": ["argument 1"],
    "citationNetwork": ["citation 1"]
  }
}`;

    default:
      return `${basePrompt} Return ONLY a JSON object with this structure:
{
  "summary": "2-3 sentence summary focusing on key sections",
  "keyPoints": ["point 1", "point 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "riskScore": number between 1-10
}`;
  }
}

async function analyzeSection(section: DocumentSection, agentType: AgentType): Promise<DocumentAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: [
        {
          role: "system",
          content: getSystemPromptForAgent(agentType)
        },
        {
          role: "user",
          content: `Analyze this section titled "${section.title}":\n\n${section.content}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 800
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    let analysis: DocumentAnalysis;
    try {
      analysis = JSON.parse(content);
    } catch (error) {
      console.error("Failed to parse OpenAI response:", content);
      throw new Error("Invalid JSON response from OpenAI");
    }

    return analysis;
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}

async function processWithRetry(section: DocumentSection, agentType: AgentType): Promise<DocumentAnalysis> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await analyzeSection(section, agentType);
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === MAX_RETRIES - 1) throw error;
      await wait(INITIAL_RETRY_DELAY * Math.pow(2, attempt));
    }
  }
  throw new Error("Failed after maximum retries");
}

export async function analyzeDocument(text: string, agentType: AgentType, sections: DocumentSection[] = []): Promise<DocumentAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  // If no sections provided, create one from the full text
  if (sections.length === 0) {
    sections = [{
      title: "Main Content",
      content: text,
      level: 1
    }];
  }

  console.log(`Analyzing ${sections.length} sections with ${agentType} agent`);

  const results: DocumentAnalysis[] = [];
  for (let i = 0; i < sections.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = sections.slice(i, i + MAX_CONCURRENT_REQUESTS);
    try {
      const batchResults = await Promise.all(
        batch.map(async (section) => {
          console.log(`Processing section: ${section.title}`);
          return processWithRetry(section, agentType);
        })
      );
      results.push(...batchResults);
    } catch (error) {
      console.error("Failed to process section:", error);
      throw new Error("Failed to analyze document completely");
    }
  }

  return combineResults(results, agentType);
}

function combineResults(results: DocumentAnalysis[], agentType: AgentType): DocumentAnalysis {
  const combinedAnalysis: DocumentAnalysis = {
    summary: results.map(r => r.summary).join(" "),
    keyPoints: Array.from(new Set(results.flatMap(r => r.keyPoints))),
    suggestions: Array.from(new Set(results.flatMap(r => r.suggestions))),
    riskScore: Math.round(results.reduce((acc, r) => acc + r.riskScore, 0) / results.length)
  };

  switch (agentType) {
    case "CONTRACT_AUTOMATION":
      combinedAnalysis.contractDetails = results.reduce((acc, r) => {
        if (!r.contractDetails) return acc;
        return {
          parties: [...new Set([...(acc?.parties || []), ...(r.contractDetails.parties || [])])],
          effectiveDate: r.contractDetails.effectiveDate || acc?.effectiveDate,
          termLength: r.contractDetails.termLength || acc?.termLength,
          keyObligations: [...new Set([...(acc?.keyObligations || []), ...(r.contractDetails.keyObligations || [])])],
          terminationClauses: [...new Set([...(acc?.terminationClauses || []), ...(r.contractDetails.terminationClauses || [])])],
          governingLaw: r.contractDetails.governingLaw || acc?.governingLaw,
          paymentTerms: r.contractDetails.paymentTerms || acc?.paymentTerms,
          disputeResolution: r.contractDetails.disputeResolution || acc?.disputeResolution,
          missingClauses: [...new Set([...(acc?.missingClauses || []), ...(r.contractDetails.missingClauses || [])])],
          suggestedClauses: [...new Set([...(acc?.suggestedClauses || []), ...(r.contractDetails.suggestedClauses || [])])],
          riskFactors: [...new Set([...(acc?.riskFactors || []), ...(r.contractDetails.riskFactors || [])])]
        };
      }, {} as NonNullable<DocumentAnalysis['contractDetails']>);
      break;

    case "COMPLIANCE_AUDITING":
      combinedAnalysis.complianceDetails = results.reduce((acc, r) => {
        if (!r.complianceDetails) return acc;
        return {
          regulatoryFrameworks: [...new Set([...(acc?.regulatoryFrameworks || []), ...(r.complianceDetails.regulatoryFrameworks || [])])],
          complianceStatus: r.complianceDetails.complianceStatus || acc?.complianceStatus,
          violations: [...new Set([...(acc?.violations || []), ...(r.complianceDetails.violations || [])])],
          requiredActions: [...new Set([...(acc?.requiredActions || []), ...(r.complianceDetails.requiredActions || [])])],
          deadlines: [...new Set([...(acc?.deadlines || []), ...(r.complianceDetails.deadlines || [])])],
          auditTrail: [...new Set([...(acc?.auditTrail || []), ...(r.complianceDetails.auditTrail || [])])],
          riskAreas: [...new Set([...(acc?.riskAreas || []), ...(r.complianceDetails.riskAreas || [])])],
          recommendedControls: [...new Set([...(acc?.recommendedControls || []), ...(r.complianceDetails.recommendedControls || [])])]
        };
      }, {} as NonNullable<DocumentAnalysis['complianceDetails']>);
      break;

    case "LEGAL_RESEARCH":
      combinedAnalysis.researchDetails = results.reduce((acc, r) => {
        if (!r.researchDetails) return acc;
        return {
          relevantCases: [...new Set([...(acc?.relevantCases || []), ...(r.researchDetails.relevantCases || [])])],
          precedents: [...new Set([...(acc?.precedents || []), ...(r.researchDetails.precedents || [])])],
          statutes: [...new Set([...(acc?.statutes || []), ...(r.researchDetails.statutes || [])])],
          legalPrinciples: [...new Set([...(acc?.legalPrinciples || []), ...(r.researchDetails.legalPrinciples || [])])],
          jurisdictions: [...new Set([...(acc?.jurisdictions || []), ...(r.researchDetails.jurisdictions || [])])],
          timelineSummary: r.researchDetails.timelineSummary || acc?.timelineSummary,
          argumentAnalysis: [...new Set([...(acc?.argumentAnalysis || []), ...(r.researchDetails.argumentAnalysis || [])])],
          citationNetwork: [...new Set([...(acc?.citationNetwork || []), ...(r.researchDetails.citationNetwork || [])])]
        };
      }, {} as NonNullable<DocumentAnalysis['researchDetails']>);
      break;
  }

  return combinedAnalysis;
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
      model: "gpt-4-1106-preview",
      messages: [
        {
          role: "system",
          content: `You are a legal document assistant. Use the provided analysis to answer questions accurately and concisely.

Document Summary: ${analysis.summary}
Risk Score: ${analysis.riskScore}/10`
        },
        {
          role: "user",
          content: `Context: ${context.substring(0, MAX_CHUNK_LENGTH)}...

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