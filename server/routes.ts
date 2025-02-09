import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import documentsRouter from "./routes/documents";
import { UserRole } from "@shared/schema";
import { createCheckoutSession, createPortalSession } from './stripe';
import legalResearchRouter from "./routes/legalResearch";
import predictiveMonitoringRouter from "./routes/predictiveMonitoring";
import orchestratorRouter from "./routes/orchestrator";
import cors from 'cors';

export function registerRoutes(app: Express): Server {
  // Enable CORS for all routes
  app.use(cors());

  const server = createServer(app);

  // Add the legal research router
  app.use("/api/legal", legalResearchRouter);

  // Register the documents router
  app.use(documentsRouter);

  // Add predictive monitoring routes
  app.use("/api/monitoring", predictiveMonitoringRouter);

  // Add orchestrator routes - update path to group all orchestrator endpoints
  app.use("/api/orchestrator", orchestratorRouter);

  // Add Stripe payment endpoints
  app.post("/api/checkout", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "You must be logged in to create a subscription",
        code: "NOT_AUTHENTICATED"
      });
    }
    await createCheckoutSession(req, res);
  });

  app.post("/api/create-portal-session", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "You must be logged in to access billing portal",
        code: "NOT_AUTHENTICATED"
      });
    }
    await createPortalSession(req, res);
  });

  // Add new middleware for role-based access control
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Authentication required",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({
        message: "Failed to fetch users",
        code: "FETCH_ERROR"
      });
    }
  });

  // Add endpoint to fetch pending approvals for a user
  app.get("/api/approvals/pending", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Authentication required",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const pendingApprovals = await storage.getPendingApprovals(req.user!.id);
      res.json(pendingApprovals);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      res.status(500).json({
        message: "Failed to fetch pending approvals",
        code: "FETCH_ERROR"
      });
    }
  });

  // Update the existing request-review endpoint with better status handling
  app.post("/api/documents/:id/request-review", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Authentication required",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);

      if (!document || document.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { approverId } = req.body;
      const approver = await storage.getUser(approverId);

      if (!approver) {
        return res.status(400).json({
          message: "Invalid approver selected",
          code: "INVALID_APPROVER"
        });
      }

      // Create approval request
      const approval = await storage.createApproval({
        documentId,
        requesterId: req.user!.id,
        approverId,
        status: "PENDING",
        comments: req.body.comments
      });

      // Update document status to REVIEW
      await storage.updateDocument(documentId, {
        analysis: {
          ...document.analysis,
          contractDetails: {
            ...document.analysis.contractDetails,
            workflowState: {
              ...document.analysis.contractDetails?.workflowState,
              status: "REVIEW",
              currentReviewer: approver.username
            }
          }
        }
      });

      res.json(approval);
    } catch (error) {
      console.error('Error requesting review:', error);
      res.status(500).json({
        message: "Failed to request review",
        code: "REVIEW_REQUEST_ERROR"
      });
    }
  });

  // Update the existing approve endpoint with middleware
  app.post("/api/documents/:id/approve", requireRole("ADMIN"), async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);

      if (!document) {
        return res.status(404).json({
          message: "Document not found",
          code: "NOT_FOUND"
        });
      }

      // Update approval status
      const [approval] = await storage.getApprovalByDocumentIdAndStatus(documentId, "PENDING");

      if (approval) {
        await storage.updateApproval(approval.id, "APPROVED", req.body.comments);
      }

      // Update document status
      await storage.updateDocument(documentId, {
        analysis: {
          ...document.analysis,
          contractDetails: {
            ...document.analysis.contractDetails,
            workflowState: {
              ...document.analysis.contractDetails?.workflowState,
              status: "APPROVAL"
            }
          }
        }
      });

      res.json({ message: "Document approved successfully" });
    } catch (error) {
      console.error('Error approving document:', error);
      res.status(500).json({
        message: "Failed to approve document",
        code: "APPROVAL_ERROR"
      });
    }
  });

  app.post("/api/documents/:id/request-signature", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Authentication required",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);

      if (!document || document.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { signerEmails } = req.body;

      // Create signature requests
      const signaturePromises = signerEmails.map(async (email: string) => {
        const user = await storage.getUserByEmail(email);
        if (!user) {
          throw new Error(`User not found for email: ${email}`);
        }

        // Generate unique signature link
        const signatureToken = createHash('sha256')
          .update(`${documentId}-${user.id}-${Date.now()}`)
          .digest('hex');

        return storage.createSignature({
          documentId,
          userId: user.id,
          status: "PENDING",
          signatureData: {
            token: signatureToken,
            email: email
          },
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });
      });

      const signatures = await Promise.all(signaturePromises);

      // Update document status
      await storage.updateDocument(documentId, {
        analysis: {
          ...document.analysis,
          contractDetails: {
            ...document.analysis.contractDetails,
            workflowState: {
              ...document.analysis.contractDetails?.workflowState,
              status: "SIGNATURE",
              signatureStatus: {
                required: signerEmails,
                completed: []
              }
            }
          }
        }
      });

      // Send email notifications
      const emailPromises = signatures.map(signature =>
        sendEmail({
          to: signature.signatureData.email,
          from: "noreply@legalai.com",
          subject: "Document Signature Request",
          text: `You havea new document to sign. Click here toview and sign: ${process.env.APP_URL}/sign/${signature.signatureData.token}`,
          html: `<p>You have a new document to sign. <a href="${process.env.APP_URL}/sign/${signature.signatureData.token}">Click here</a> to view and sign.</p>`
        })
      );

      await Promise.all(emailPromises);

      res.json({ signatures });
    } catch (error) {
      console.error('Error requesting signatures:', error);
      res.status(500).json({
        message: "Failed to request signatures",
        code: "SIGNATURE_REQUEST_ERROR"
      });
    }
  });

  // Add route for signing documents
  app.post("/api/documents/sign/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { signatureData } = req.body;

      // Find signature request
      const [signature] = await storage.getSignatureByToken(token);

      if (!signature) {
        return res.status(404).json({
          message: "Invalid or expired signature token",
          code: "INVALID_TOKEN"
        });
      }

      // Update signature status
      await storage.updateSignature(signature.id, "COMPLETED", signatureData);

      // Check if all signatures are completed
      const allSignatures = await storage.getSignaturesByDocumentId(signature.documentId);

      const allCompleted = allSignatures.every(s => s.status === "COMPLETED");

      if (allCompleted) {
        const document = await storage.getDocument(signature.documentId);
        if (document) {
          await storage.updateDocument(document.id, {
            analysis: {
              ...document.analysis,
              contractDetails: {
                ...document.analysis.contractDetails,
                workflowState: {
                  ...document.analysis.contractDetails?.workflowState,
                  status: "COMPLETED",
                  signatureStatus: {
                    required: allSignatures.length,
                    completed: allSignatures.length
                  }
                }
              }
            }
          });
        }
      }

      res.json({ message: "Document signed successfully" });
    } catch (error) {
      console.error('Error signing document:', error);
      res.status(500).json({
        message: "Failed to sign document",
        code: "SIGNATURE_ERROR"
      });
    }
  });

  // Add route for getting document versions
  app.get("/api/documents/:id/versions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Authentication required",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);

      if (!document || (document.userId !== req.user!.id && req.user!.role !== "ADMIN")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const versions = await storage.getVersions(documentId);
      res.json(versions);
    } catch (error) {
      console.error('Error fetching versions:', error);
      res.status(500).json({
        message: "Failed to fetch versions",
        code: "VERSION_FETCH_ERROR"
      });
    }
  });

  // Add this route after the existing routes
  app.get("/api/users/admins", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Authentication required",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      const admins = await storage.getUsersByRole("ADMIN");
      res.json(admins);
    } catch (error) {
      console.error('Error fetching admins:', error);
      res.status(500).json({
        message: "Failed to fetch admin users",
        code: "FETCH_ERROR"
      });
    }
  });

  app.use("/api/orchestrator", orchestratorRouter);

  return server;
}

// Placeholder function - needs actual implementation
function sendEmail(options: any): Promise<void> {
    console.log("Sending email:", options);
    return Promise.resolve();
}

// Placeholder - needs actual implementation from crypto library
const createHash = (algorithm: string) => ({
    update: (data: string) => ({
        digest: (encoding: string) => data //Replace with actual hash generation
    })
})

function requireRole(role: UserRole) {
  return (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Authentication required",
        code: "NOT_AUTHENTICATED"
      });
    }

    if (req.user.role !== role && req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Insufficient permissions",
        code: "FORBIDDEN"
      });
    }

    next();
  };
}