import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import documentsRouter from "./routes/documents";
import complianceRouter from "./routes/compliance";
import metricsRouter from "./routes/metrics";
import { UserRole } from "@shared/schema";
import { createCheckoutSession, createPortalSession, handleWebhook } from './stripe';
import legalResearchRouter from "./routes/legal-research";
import predictiveMonitoringRouter from "./routes/predictiveMonitoring";
import orchestratorRouter from "./routes/orchestrator";
import contractAnalysisRouter from "./routes/contract-analysis";
import reportsRouter from "./routes/reports";
import vaultRouter from "./routes/vault";
import redlineRouter from "./routes/redline";
import cors from 'cors';
import { json } from 'express';

export function registerRoutes(app: Express): Server {
  // Enable CORS with proper options
  app.use(cors({
    origin: true,
    credentials: true
  }));

  // Parse JSON bodies
  app.use(json());

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

  // Legal Research routes - ensure it's mounted at the root path
  app.use("/api/legal-research", legalResearchRouter);

  // Add redlining routes
  app.use("/api/redline", redlineRouter);

  // Add the vault router with enhanced AI capabilities
  app.use("/api/vault", vaultRouter);

  // Register the documents router
  app.use("/api", documentsRouter);

  // Add compliance routes
  app.use("/api/compliance", complianceRouter);

  // Add metrics routes
  app.use("/api/metrics", metricsRouter);

  // Add reports routes
  app.use("/api", reportsRouter);

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