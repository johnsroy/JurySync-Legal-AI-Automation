import OpenAI from "openai";
import { PDFDocument } from "pdf-lib";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ComplianceAnalysisResult {
  score: number;
  issues: Array<{
    severity: 'high' | 'medium' | 'low';
    description: string;
    recommendation: string;
  }>;
  summary: string;
}

export async function analyzeComplianceDocument(pdfBuffer: Buffer): Promise<ComplianceAnalysisResult> {
  try {
    // Extract text from PDF
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    let fullText = '';

    for (const page of pages) {
      // Extract text content using pdf-lib's built-in text extraction
      const { text } = await page.doc.embedFont(page.doc.registerFontkit());
      fullText += text + '\n';
    }

    // Analyze with GPT-4o
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a legal compliance expert. Analyze the provided document for compliance issues and provide a structured analysis with a compliance score (0-100), identified issues, and recommendations."
        },
        {
          role: "user",
          content: fullText
        }
      ],
      response_format: { type: "json_object" }
    });

    const analysisText = response.choices[0].message.content;
    if (!analysisText) {
      throw new Error("No analysis received from OpenAI");
    }

    const analysis = JSON.parse(analysisText);

    return {
      score: analysis.compliance_score,
      issues: analysis.identified_issues.map((issue: any) => ({
        severity: issue.severity as 'high' | 'medium' | 'low',
        description: issue.description,
        recommendation: issue.recommendation
      })),
      summary: analysis.summary
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error analyzing compliance document:', errorMessage);
    throw new Error(`Failed to analyze compliance document: ${errorMessage}`);
  }
}

export async function suggestCompliance(text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a legal compliance expert. Provide specific suggestions to improve compliance based on the identified issues."
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    const suggestion = response.choices[0].message.content;
    if (!suggestion) {
      throw new Error("No suggestions received from OpenAI");
    }

    return suggestion;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error generating compliance suggestions:', errorMessage);
    throw new Error(`Failed to generate compliance suggestions: ${errorMessage}`);
  }
}