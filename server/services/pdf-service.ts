import PDFDocument from 'pdfkit';

interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
}

export async function generatePDF(content: string, metadata: PDFMetadata = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      // Handle document metadata
      if (metadata.title) doc.info.Title = metadata.title;
      if (metadata.author) doc.info.Author = metadata.author;
      if (metadata.subject) doc.info.Subject = metadata.subject;
      if (metadata.keywords) doc.info.Keywords = metadata.keywords.join(', ');

      // Collect chunks
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      // Add content
      doc.fontSize(12)
         .text(content, {
           align: 'left',
           lineGap: 5
         });

      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
