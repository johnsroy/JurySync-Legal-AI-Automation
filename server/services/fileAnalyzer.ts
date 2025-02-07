import { type Buffer } from "buffer";
import pdf from "pdf-parse/lib/pdf-parse.js"; // Updated import to avoid test file loading
import { db } from "../db";
import { complianceDocuments } from "@shared/schema";
import { eq } from "drizzle-orm";

const MAX_CONTENT_LENGTH = 32000; // Maximum content length for analysis

export async function analyzePDFContent(buffer: Buffer, documentId: number): Promise<string> {
  try {
    console.log(`Starting PDF analysis${documentId !== -1 ? ` for document ${documentId}` : ''}`);

    // Parse PDF and extract text
    const pdfData = await pdf(buffer, {
      max: 0, // No page limit
      version: 'v2.0.550'
    });
    let textContent = pdfData.text || '';

    console.log(`Raw content extracted, length: ${textContent.length}`);

    // Basic content cleaning
    textContent = textContent
      .replace(/\u0000/g, '') // Remove null bytes
      .replace(/^\s*<!DOCTYPE[^>]*>/i, '') // Remove DOCTYPE at start
      .replace(/[\uFFFD\uFFFE\uFFFF]/g, '') // Remove replacement characters
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // Remove control characters
      .trim();

    if (!textContent) {
      throw new Error('Failed to extract valid content from PDF');
    }

    // Truncate if necessary while preserving word boundaries
    if (textContent.length > MAX_CONTENT_LENGTH) {
      console.log(`Content exceeds maximum length, truncating from ${textContent.length} to ~${MAX_CONTENT_LENGTH} chars`);
      textContent = textContent.substring(0, MAX_CONTENT_LENGTH).replace(/\s+[^\s]*$/, '');
    }

    console.log(`Final content length: ${textContent.length}`);

    // Only update database if a valid document ID was provided
    if (documentId !== -1) {
      try {
        await db
          .update(complianceDocuments)
          .set({
            content: textContent,
            status: "MONITORING",
            lastScanned: new Date(),
            nextScanDue: new Date(Date.now() + 24 * 60 * 60 * 1000),
          })
          .where(eq(complianceDocuments.id, documentId));

        console.log('Database updated successfully');
      } catch (dbError) {
        console.error('Database update error:', dbError);
        throw new Error('Failed to update document in database');
      }
    }

    return textContent;

  } catch (error) {
    console.error("PDF analysis error:", error);

    if (documentId !== -1) {
      try {
        await db
          .update(complianceDocuments)
          .set({ status: "ERROR" })
          .where(eq(complianceDocuments.id, documentId));
      } catch (dbError) {
        console.error('Failed to update error status:', dbError);
      }
    }

    throw error;
  }
}