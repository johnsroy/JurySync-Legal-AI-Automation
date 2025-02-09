import path from "path";
import fs from "fs/promises";
import { type ComplianceFile, complianceFiles, complianceDocuments } from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { analyzePDFContent } from "./fileAnalyzer";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Add more flexible MIME types
  'application/x-pdf',
  'application/acrobat',
  'applications/vnd.pdf',
  'text/pdf',
  'application/msword',
  'application/doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-word.document.macroEnabled.12'
];

// Enhanced logging function
function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [FileUpload] [${type.toUpperCase()}] ${message}`, context ? context : '');
}

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    log("Failed to create upload directory", 'error', error);
    throw new Error("Failed to initialize upload system");
  }
}

export async function saveUploadedFile(
  file: Express.Multer.File,
  userId: number,
  title: string
): Promise<ComplianceFile> {
  await ensureUploadDir();

  log('Starting file upload process', 'info', {
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  // More lenient MIME type checking
  const isAllowedType = ALLOWED_MIME_TYPES.some(type => 
    file.mimetype.includes('pdf') || 
    file.mimetype.includes('word') || 
    file.mimetype === type
  );

  if (!isAllowedType) {
    log('Invalid file type', 'error', { mimetype: file.mimetype });
    throw new Error('Invalid file type. Only PDF and Word documents are allowed.');
  }

  const timestamp = Date.now();
  const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueFilename = `${timestamp}-${safeName}`;
  const filePath = path.join(UPLOAD_DIR, uniqueFilename);

  try {
    // Save file to disk
    await fs.writeFile(filePath, file.buffer);

    // Create file record
    const [fileRecord] = await db
      .insert(complianceFiles)
      .values({
        userId,
        filename: file.originalname,
        filePath: uniqueFilename,
        fileType: file.mimetype,
        fileSize: file.size,
        status: "PROCESSING",
        processingStartedAt: new Date()
      })
      .returning();

    // Process the document content
    try {
      log('Starting document analysis...');
      const content = await analyzePDFContent(file.buffer, -1);
      log('Document analysis completed successfully');

      // Create compliance document record
      const [docRecord] = await db
        .insert(complianceDocuments)
        .values({
          userId,
          title: title || file.originalname,
          content,
          documentType: file.mimetype.includes('pdf') ? 'PDF' : 'DOCX',
          status: "MONITORING",
          lastScanned: new Date(),
          nextScanDue: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })
        .returning();

      // Update file record status
      await db
        .update(complianceFiles)
        .set({
          status: "PROCESSED",
          processingCompletedAt: new Date()
        })
        .where(eq(complianceFiles.id, fileRecord.id));

      return {
        ...fileRecord,
        status: "PROCESSED"
      };
    } catch (error: any) {
      log('Document processing error', 'error', error);

      // Update file record with error status
      const [updatedRecord] = await db
        .update(complianceFiles)
        .set({
          status: "ERROR",
          errorMessage: error.message
        })
        .where(eq(complianceFiles.id, fileRecord.id))
        .returning();

      throw error;
    }
  } catch (error) {
    log('File upload error', 'error', error);
    // Cleanup on failure
    try {
      await fs.unlink(filePath).catch(() => {});
    } catch (cleanupError) {
      log("Failed to cleanup file after error", 'error', cleanupError);
    }
    throw error;
  }
}

export async function getUploadedFile(filePath: string): Promise<Buffer> {
  const fullPath = path.join(UPLOAD_DIR, filePath);
  return fs.readFile(fullPath);
}

export async function deleteUploadedFile(filePath: string): Promise<void> {
  const fullPath = path.join(UPLOAD_DIR, filePath);
  await fs.unlink(fullPath);
}