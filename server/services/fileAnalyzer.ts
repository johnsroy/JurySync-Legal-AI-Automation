import { type Buffer } from "buffer";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { db } from "../db";
import { complianceDocuments } from "@shared/schema";
import { eq } from "drizzle-orm";

const MAX_CONTENT_LENGTH = 32000;

export async function analyzePDFContent(buffer: Buffer, documentId: number): Promise<string> {
  try {
    console.log(`Starting PDF analysis${documentId !== -1 ? ` for document ${documentId}` : ''}`);

    // Parse PDF with more robust options
    const pdfData = await pdf(buffer, {
      max: 0,
      version: 'v2.0.550',
      pagerender: function(pageData: any) {
        return pageData.getTextContent();
      }
    }).catch(async (err) => {
      console.log('Initial PDF parse failed, attempting fallback method:', err);
      // Fallback to raw buffer parsing if standard parse fails
      return pdf(buffer, { max: 0, version: 'v2.0.550' });
    });

    let textContent = '';
    if (pdfData && typeof pdfData.text === 'string') {
      textContent = pdfData.text;
    } else if (pdfData && Array.isArray(pdfData.text)) {
      textContent = pdfData.text.join(' ');
    }

    console.log(`Raw content extracted, length: ${textContent.length}`);

    // Enhanced content cleaning with better DOCTYPE handling
    textContent = textContent
      .replace(/^\s*(?:<!DOCTYPE[^>]*>|<\?xml[^>]*\?>)/gi, '') // Remove DOCTYPE and XML declarations
      .replace(/[\uFFFD\uFFFE\uFFFF]/g, '') // Remove replacement characters
      .replace(/[\u0000-\u001F]/g, ' ') // Replace control characters with spaces
      .replace(/<[^>]*>/g, ' ') // Replace HTML tags with spaces
      .replace(/&[a-z]+;/gi, ' ') // Replace HTML entities with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (!textContent) {
      throw new Error('No valid content could be extracted from PDF');
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

  } catch (error: any) {
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

    throw new Error(`Failed to analyze PDF: ${error.message}`);
  }
}