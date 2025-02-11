import { Router } from 'express';
import { generateCompliancePDF } from '../services/reportGenerator';
import { db } from '../db';
import { complianceAudits, documents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import PDFKit from 'pdfkit';

const router = Router();

// Existing compliance report endpoint
router.post('/api/reports/compliance/generate', async (req, res) => {
  try {
    const { auditId, config } = req.body;

    // Fetch the compliance audit data
    const [audit] = await db
      .select()
      .from(complianceAudits)
      .where(eq(complianceAudits.id, auditId));

    if (!audit) {
      return res.status(404).json({ error: 'Compliance audit not found' });
    }

    // Generate PDF
    const pdfBuffer = await generateCompliancePDF(audit.combinedReport, config);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=compliance-audit-${auditId}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send the PDF
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

// New endpoint for exporting all reports
router.get('/api/reports/export-all', async (req, res) => {
  try {
    // Create a new PDF document
    const doc = new PDFKit();
    const chunks: Buffer[] = [];

    // Collect PDF chunks
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=legal-reports-${new Date().toISOString().split('T')[0]}.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    });

    // Add title
    doc.fontSize(25).text('Combined Legal Reports', { align: 'center' });
    doc.moveDown();

    // Fetch all documents
    const allDocuments = await db.select().from(documents);

    // Add document summaries
    for (const document of allDocuments) {
      doc.fontSize(16).text(document.title || 'Untitled Document');
      doc.fontSize(12).text(`Created: ${document.createdAt ? new Date(document.createdAt).toLocaleDateString() : 'Date not available'}`);
      if (document.analysis && typeof document.analysis === 'object' && 'summary' in document.analysis) {
        doc.moveDown()
          .fontSize(14).text('Analysis Summary:')
          .fontSize(12).text(document.analysis.summary as string);
      }
      doc.moveDown().moveDown();
    }

    // Fetch compliance audits
    const audits = await db.select().from(complianceAudits);

    // Add compliance audit summaries
    if (audits.length > 0) {
      doc.addPage();
      doc.fontSize(20).text('Compliance Audits', { align: 'center' });
      doc.moveDown();

      for (const audit of audits) {
        doc.fontSize(16).text(`Audit ID: ${audit.id}`);
        doc.fontSize(12).text(`Date: ${audit.createdAt ? new Date(audit.createdAt).toLocaleDateString() : 'Date not available'}`);
        if (audit.combinedReport) {
          doc.moveDown()
            .fontSize(14).text('Findings:')
            .fontSize(12).text(JSON.stringify(audit.combinedReport, null, 2));
        }
        doc.moveDown().moveDown();
      }
    }

    // Finalize the PDF
    doc.end();

  } catch (error) {
    console.error('Export all reports error:', error);
    res.status(500).json({ error: 'Failed to generate combined reports' });
  }
});

export default router;