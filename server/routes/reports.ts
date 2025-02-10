import { Router } from 'express';
import { generateCompliancePDF } from '../services/reportGenerator';
import { db } from '../db';
import { complianceAudits } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

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
    const pdfBuffer = await generateCompliancePDF(audit.combinedReport.auditReport, config);

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

export default router;
