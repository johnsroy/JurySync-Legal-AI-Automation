import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import documentsRouter from "./routes/documents";
import complianceRouter from "./routes/compliance";
import metricsRouter from "./routes/metrics";
import { UserRole } from "@shared/schema";
import { createCheckoutSession, createPortalSession, handleWebhook } from './stripe';
import legalResearchRouter from "./routes/legalResearch";
import predictiveMonitoringRouter from "./routes/predictiveMonitoring";
import orchestratorRouter from "./routes/orchestrator";
import contractAnalysisRouter from "./routes/contract-analysis";
import cors from 'cors';
import { json } from 'express';

export function registerRoutes(app: Express): Server {
  // Enable CORS for all routes
  app.use(cors());

  const server = createServer(app);

  // Special handling for Stripe webhook endpoint - needs raw body
  app.post("/api/webhook", 
    json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      }
    }), 
    handleWebhook
  );

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