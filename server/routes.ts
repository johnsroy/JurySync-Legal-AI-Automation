import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import documentsRouter from "./routes/documents";
import complianceRouter from "./routes/compliance";
import metricsRouter from "./routes/metrics";
import { UserRole } from "@shared/schema";
import { createCheckoutSession, createPortalSession } from './stripe';
import legalResearchRouter from "./routes/legalResearch";
import predictiveMonitoringRouter from "./routes/predictiveMonitoring";
import orchestratorRouter from "./routes/orchestrator";
import contractAnalysisRouter from "./routes/contract-analysis";
import cors from 'cors';
import { workflowOrchestrator } from "./services/workflowOrchestrator";

export function registerRoutes(app: Express): Server {
  // Enable CORS for all routes
  app.use(cors());

  const server = createServer(app);

  // Add workflow automation routes
  app.post("/api/workflow/draft", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Document text is required" });
      }

      // Initialize review process
      const result = await workflowOrchestrator.initiateReview(1); // TODO: Get actual contract ID
      res.json(result);
    } catch (error) {
      console.error("Error in draft workflow:", error);
      res.status(500).json({ error: "Failed to process draft" });
    }
  });

  app.post("/api/workflow/compliance", async (req, res) => {
    try {
      const { documentId } = req.body;
      if (!documentId) {
        return res.status(400).json({ error: "Document ID is required" });
      }

      // Get compliance report
      const report = await workflowOrchestrator.getDiagnosticReport(parseInt(documentId));
      res.json(report);
    } catch (error) {
      console.error("Error in compliance workflow:", error);
      res.status(500).json({ error: "Failed to process compliance check" });
    }
  });

  app.post("/api/workflow/collaborate", async (req, res) => {
    try {
      const { documentId } = req.body;
      if (!documentId) {
        return res.status(400).json({ error: "Document ID is required" });
      }

      const result = await workflowOrchestrator.initiateReview(parseInt(documentId));
      res.json(result);
    } catch (error) {
      console.error("Error in collaboration workflow:", error);
      res.status(500).json({ error: "Failed to process collaboration" });
    }
  });

  app.post("/api/workflow/version", async (req, res) => {
    try {
      const { documentId } = req.body;
      if (!documentId) {
        return res.status(400).json({ error: "Document ID is required" });
      }

      const versions = await workflowOrchestrator.getVersionHistory(parseInt(documentId));
      res.json(versions);
    } catch (error) {
      console.error("Error in version workflow:", error);
      res.status(500).json({ error: "Failed to fetch version history" });
    }
  });

  app.post("/api/workflow/risk", async (req, res) => {
    try {
      const { documentId } = req.body;
      if (!documentId) {
        return res.status(400).json({ error: "Document ID is required" });
      }

      const report = await workflowOrchestrator.getDiagnosticReport(parseInt(documentId));
      res.json(report);
    } catch (error) {
      console.error("Error in risk workflow:", error);
      res.status(500).json({ error: "Failed to process risk analysis" });
    }
  });

  app.post("/api/workflow/signature", async (req, res) => {
    try {
      const { documentId } = req.body;
      if (!documentId) {
        return res.status(400).json({ error: "Document ID is required" });
      }

      const result = await workflowOrchestrator.initiateSignature(parseInt(documentId));
      res.json(result);
    } catch (error) {
      console.error("Error in signature workflow:", error);
      res.status(500).json({ error: "Failed to process signature request" });
    }
  });

  // Add the legal research router
  app.use("/api/legal", legalResearchRouter);

  // Register the documents router
  app.use(documentsRouter);

  // Add compliance routes
  app.use("/api/compliance", complianceRouter);

  // Add metrics routes
  app.use("/api/metrics", metricsRouter);

  // Add predictive monitoring routes
  app.use("/api/monitoring", predictiveMonitoringRouter);

  // Add orchestrator routes
  app.use("/api/orchestrator", orchestratorRouter);

  // Add contract analysis routes
  app.use("/api/contract-analysis", contractAnalysisRouter);

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

  return server;
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