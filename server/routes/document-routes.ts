import { Router } from "express";
import multer from "multer";
import { parseDocument, DocumentParsingError } from "../services/document-parser";
import { randomUUID } from "crypto";
import { storage } from "../storage";

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_, file, cb) => {
    const allowedTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

const router = Router();

router.post("/api/documents/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const documentId = randomUUID();
    const parsedDocument = await parseDocument(req.file.path, req.file.originalname);

    // Store document metadata
    const documentMetadata = await storage.saveDocument({
      id: documentId,
      userId: req.user?.id,
      filename: req.file.originalname,
      fileType: req.file.mimetype,
      pageCount: parsedDocument.metadata.pageCount,
      wordCount: parsedDocument.metadata.wordCount,
      status: "parsed",
      createdAt: new Date(),
    });

    return res.json({
      documentId,
      parsedText: parsedDocument.text,
      status: "success",
      metadata: documentMetadata,
    });
  } catch (error) {
    if (error instanceof DocumentParsingError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
        code: error.code,
      });
    }

    console.error("Document upload error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to process document",
    });
  }
});

router.get("/api/documents", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const documents = await storage.getUserDocuments(req.user.id);
    return res.json(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch documents",
    });
  }
});

router.get("/api/documents/:id", async (req, res) => {
  try {
    const document = await storage.getDocument(req.params.id);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (document.userId && document.userId !== req.user?.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    return res.json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch document",
    });
  }
});

export default router;