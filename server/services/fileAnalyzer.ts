import { type Buffer } from "buffer";
import pdf from "pdf-parse";
import Anthropic from '@anthropic-ai/sdk';
import { db } from "../db";
import { complianceDocuments } from "@shared/schema";
import { eq } from "drizzle-orm";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function analyzePDFContent(buffer: Buffer, documentId: number): Promise<void> {
  try {
    // Parse PDF directly without JSON intermediary
    const pdfData = await pdf(buffer);
    const textContent = pdfData.text;
    
    // Use Anthropic for direct text analysis
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Analyze this legal document for compliance issues and risks. Document text:\n\n${textContent.substring(0, 8000)}`
      }]
    });

    const analysis = response.content[0].text;

    // Update document with analysis results
    await db
      .update(complianceDocuments)
      .set({
        content: textContent,
        status: "MONITORING",
        lastScanned: new Date(),
        nextScanDue: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next scan in 24 hours
      })
      .where(eq(complianceDocuments.id, documentId));

  } catch (error) {
    console.error("PDF analysis error:", error);
    
    // Update document status to error
    await db
      .update(complianceDocuments)
      .set({ status: "ERROR" })
      .where(eq(complianceDocuments.id, documentId));

    throw error;
  }
}
