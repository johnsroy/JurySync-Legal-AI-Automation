import { Router } from "express";
import { db } from "../db";
import { complianceAudits, documents } from "@shared/schema";
import { eq } from "drizzle-orm";
import { pdfService } from "../services/pdf-service";
import { Readable } from "stream";

const router = Router();

router.post("/reports/compliance/generate", async (req, res) => {
  try {
    const { auditId, config } = req.body;

    const [audit] = await db
      .select()
      .from(complianceAudits)
      .where(eq(complianceAudits.id, auditId));

    if (!audit) {
      return res.status(404).json({ error: "Compliance audit not found" });
    }

    const pdfDoc = await pdfService.generatePDF(audit.combinedReport, {
      title: `Compliance Audit Report - ${auditId}`,
      author: "Compliance System",
      subject: "Compliance Audit Report",
      keywords: ["compliance", "audit", "report"],
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=compliance-audit-${auditId}.pdf`,
    );
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).json({ error: "Failed to generate PDF report" });
  }
});

router.get("/reports/export-all", async (req, res) => {
  try {
    const pdfDoc = await pdfService.generatePDF("Combined Legal Reports", {
      title: "Combined Legal Reports",
      author: "Legal Intelligence Platform",
      subject: "Legal Documents and Compliance Audits Report",
      keywords: ["legal", "compliance", "reports"],
    });

    // Create a buffer to store the PDF
    const chunks: Buffer[] = [];
    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => {
      const result = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=legal-reports-${new Date().toISOString().split("T")[0]}.pdf`,
      );
      res.setHeader("Content-Length", result.length);
      res.end(result);
    });

    // Add title page
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("Combined Legal Reports", {
        align: "center",
      })
      .moveDown(2);

    // Add date
    doc
      .fontSize(12)
      .font("Helvetica")
      .text(`Generated on: ${new Date().toLocaleDateString()}`, {
        align: "center",
      })
      .moveDown(2);

    // Fetch all documents
    const allDocuments = await db.select().from(documents);

    // Add document summaries
    doc
      .addPage()
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Document Summaries")
      .moveDown();

    for (const document of allDocuments) {
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(document.title || "Untitled Document")
        .moveDown(0.5);

      doc
        .fontSize(12)
        .font("Helvetica")
        .text(
          `Created: ${document.createdAt ? new Date(document.createdAt).toLocaleDateString() : "Date not available"}`,
        )
        .moveDown(0.5);

      if (document.analysis && typeof document.analysis === "object") {
        const analysis = document.analysis as { summary?: string };
        if (analysis.summary) {
          doc
            .text("Analysis Summary:", { underline: true })
            .moveDown(0.5)
            .text(analysis.summary)
            .moveDown();
        }
      }
      doc.moveDown();
    }

    // Fetch and add compliance audits
    const audits = await db.select().from(complianceAudits);

    if (audits.length > 0) {
      doc
        .addPage()
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("Compliance Audits")
        .moveDown();

      for (const audit of audits) {
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .text(`Audit ID: ${audit.id}`)
          .moveDown(0.5);

        doc
          .fontSize(12)
          .font("Helvetica")
          .text(
            `Date: ${audit.createdAt ? new Date(audit.createdAt).toLocaleDateString() : "Date not available"}`,
          )
          .moveDown(0.5);

        if (audit.combinedReport) {
          doc
            .text("Findings:", { underline: true })
            .moveDown(0.5)
            .text(
              typeof audit.combinedReport === "string"
                ? audit.combinedReport
                : JSON.stringify(audit.combinedReport, null, 2),
            )
            .moveDown();
        }
        doc.moveDown();
      }
    }

    // Add page numbers
    let pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(10)
        .text(
          `Page ${i + 1} of ${pageCount}`,
          doc.page.margins.left,
          doc.page.height - doc.page.margins.bottom - 20,
          { align: "center" },
        );
    }

    // Finalize the PDF
    doc.end();
  } catch (error) {
    console.error("Export all reports error:", error);
    res.status(500).json({ error: "Failed to generate combined reports" });
  }
});

export default router;
