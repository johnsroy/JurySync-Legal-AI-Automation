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

export async function analyzePDFContent(buffer: Buffer, documentId: number): Promise<string> {
  try {
    console.log(`Starting PDF analysis for document ${documentId}`);

    // Parse PDF and extract text
    const pdfData = await pdf(buffer);
    const textContent = pdfData.text.trim();

    if (!textContent) {
      throw new Error('Empty or invalid PDF content');
    }

    console.log(`Successfully extracted ${textContent.length} characters from PDF`);

    // Clean the content before analysis
    const cleanContent = textContent
      .replace(/<!DOCTYPE[^>]*>/gi, '') // Remove DOCTYPE declarations
      .replace(/[\uFFFD\uFFFE\uFFFF]/g, '') // Remove invalid Unicode characters
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); // Remove control characters

    console.log('Content cleaned and prepared for analysis');

    try {
      // Update document with cleaned content
      await db
        .update(complianceDocuments)
        .set({
          content: cleanContent,
          status: "MONITORING",
          lastScanned: new Date(),
          nextScanDue: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next scan in 24 hours
        })
        .where(eq(complianceDocuments.id, documentId));

      console.log('Document updated with cleaned content');

      return cleanContent;
    } catch (dbError) {
      console.error('Database update error:', dbError);
      throw new Error('Failed to update document content');
    }

  } catch (error) {
    console.error("PDF analysis error:", error);

    // Update document status to error
    try {
      await db
        .update(complianceDocuments)
        .set({ status: "ERROR" })
        .where(eq(complianceDocuments.id, documentId));
    } catch (dbError) {
      console.error('Failed to update error status:', dbError);
    }

    throw error;
  }
}