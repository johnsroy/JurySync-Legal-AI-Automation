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
import { db } from './db';
import { legalDocuments } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

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

  // Add orchestrator routes - group all orchestrator endpoints
  app.use("/api/orchestrator", orchestratorRouter);

  // Add specific route for legal research documents
  app.get("/api/legal-research/documents", async (req, res) => {
    try {
      const documents = await db
        .select()
        .from(legalDocuments)
        .orderBy(desc(legalDocuments.date));

      res.json(documents);
    } catch (error) {
      console.error('Error fetching legal documents:', error);
      res.status(500).json({
        message: "Failed to fetch legal documents",
        code: "FETCH_ERROR"
      });
    }
  });

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

  app.use("/api/orchestrator", orchestratorRouter);

  return server;
}

// Placeholder function - needs actual implementation
function sendEmail(options: any): Promise<void> {
    console.log("Sending email:", options);
    return Promise.resolve();
}

// Helper function for RBAC middleware
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