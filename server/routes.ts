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
  // First set up essential middleware
  app.use(cors({
    origin: true,
    credentials: true
  }));

  // Parse JSON bodies with larger limit for document processing
  app.use(json({ limit: '50mb' }));

  const server = createServer(app);

  // API Routes - ensure proper ordering
  // Mount API routes before any static file handling

  // Special handling for Stripe webhook endpoint - needs raw body
  app.post("/api/webhook", 
    json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      }
    }), 
    handleWebhook
  );

  // Legal Research routes - ensure proper mounting
  app.use("/api/legal-research", (req, res, next) => {
    console.log('Legal Research API Request:', {
      method: req.method,
      path: req.path,
      body: req.body
    });
    next();
  }, legalResearchRouter);

  // Mount other API routes
  app.use("/api/redline", redlineRouter);
  app.use("/api/vault", vaultRouter);
  app.use("/api", documentsRouter);
  app.use("/api/compliance", complianceRouter);
  app.use("/api/metrics", metricsRouter);
  app.use("/api", reportsRouter);
  app.use("/api/monitoring", predictiveMonitoringRouter);
  app.use("/api/orchestrator", orchestratorRouter);
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

  // Add catch-all handler for unmatched API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      path: req.originalUrl
    });
  });

  return server;
}