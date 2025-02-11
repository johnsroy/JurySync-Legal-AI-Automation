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
    // Create a new PDF document with some metadata
    const doc = new PDFKit({
      info: {
        Title: 'Combined Legal Reports',
        Author: 'Legal Intelligence Platform',
        Subject: 'Legal Documents and Compliance Audits Report'
      },
      autoFirstPage: true,
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      }
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=legal-reports-${new Date().toISOString().split('T')[0]}.pdf`);

    // Pipe the PDF document directly to the response
    doc.pipe(res);

    // Add a header with styling
    doc.font('Helvetica-Bold')
      .fontSize(24)
      .text('Combined Legal Reports', {
        align: 'center',
        underline: true
      });
    doc.moveDown(2);

    // Fetch all documents
    const allDocuments = await db.select().from(documents);

    // Add document summaries with better formatting
    doc.font('Helvetica-Bold')
      .fontSize(18)
      .text('Document Summaries', { align: 'left' });
    doc.moveDown();

    for (const document of allDocuments) {
      doc.font('Helvetica-Bold')
        .fontSize(14)
        .text(document.title || 'Untitled Document');

      doc.font('Helvetica')
        .fontSize(12)
        .text(`Created: ${document.createdAt ? new Date(document.createdAt).toLocaleDateString() : 'Date not available'}`);

      if (document.analysis && typeof document.analysis === 'object' && 'summary' in document.analysis) {
        doc.moveDown()
          .fontSize(12)
          .text('Analysis Summary:', { underline: true })
          .text(document.analysis.summary as string);
      }
      doc.moveDown(2);
    }

    // Fetch compliance audits
    const audits = await db.select().from(complianceAudits);

    // Add compliance audit summaries if any exist
    if (audits.length > 0) {
      doc.addPage();
      doc.font('Helvetica-Bold')
        .fontSize(18)
        .text('Compliance Audits', { align: 'left' });
      doc.moveDown();

      for (const audit of audits) {
        doc.font('Helvetica-Bold')
          .fontSize(14)
          .text(`Audit ID: ${audit.id}`);

        doc.font('Helvetica')
          .fontSize(12)
          .text(`Date: ${audit.createdAt ? new Date(audit.createdAt).toLocaleDateString() : 'Date not available'}`);

        if (audit.combinedReport) {
          doc.moveDown()
            .fontSize(12)
            .text('Findings:', { underline: true })
            .text(JSON.stringify(audit.combinedReport, null, 2));
        }
        doc.moveDown(2);
      }
    }

    // Add footer with page numbers
    let pageNumber = 1;
    doc.on('pageAdded', () => {
      pageNumber++;
    });

    // Finalize the PDF
    doc.end();

  } catch (error) {
    console.error('Export all reports error:', error);
    res.status(500).json({ error: 'Failed to generate combined reports' });
  }
});

export default router;