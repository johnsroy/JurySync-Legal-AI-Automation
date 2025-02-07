import path from "path";
import fs from "fs/promises";
import { type ComplianceFile, complianceFiles } from "@shared/schema";
import { db } from "../db";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    console.error("Failed to create upload directory:", error);
    throw new Error("Failed to initialize upload system");
  }
}

export async function saveUploadedFile(
  file: Express.Multer.File,
  userId: number
): Promise<ComplianceFile> {
  await ensureUploadDir();

  const timestamp = Date.now();
  const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueFilename = `${timestamp}-${safeName}`;
  const filePath = path.join(UPLOAD_DIR, uniqueFilename);

  try {
    // Save file to disk
    await fs.writeFile(filePath, file.buffer);

    // Create database record
    const [fileRecord] = await db
      .insert(complianceFiles)
      .values({
        userId,
        filename: file.originalname,
        filePath: uniqueFilename,
        fileType: file.mimetype,
        fileSize: file.size,
        status: "UPLOADED",
      })
      .returning();

    return fileRecord;
  } catch (error) {
    // Cleanup on failure
    try {
      await fs.unlink(filePath).catch(() => {});
    } catch (cleanupError) {
      console.error("Failed to cleanup file after error:", cleanupError);
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
