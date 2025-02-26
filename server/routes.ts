import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import documentsRouter from "./routes/documents";
import complianceRouter from "./routes/compliance";
import metricsRouter from "./routes/metrics";
import { UserRole } from "@shared/schema";
import { createCheckoutSession, createPortalSession, handleWebhook } from './stripe';
import legalResearchRouter from "./routes/legal-research";
import predictiveMonitoringRouter from "./routes/predictiveMonitoring";
import orchestratorRouter from "./routes/orchestrator";
import contractAnalysisRouter from "./routes/contract-analysis";
import contractAutomationRouter from "./routes/contract-automation";
import reportsRouter from "./routes/reports";
import vaultRouter from "./routes/vault";
import redlineRouter from "./routes/redline";
import paymentsRouter from "./routes/payments";
import cors from 'cors';
import { json } from 'express';

export function registerRoutes(app: Express): Server {
  // Essential middleware first
  app.use(cors({
    origin: true,
    credentials: true
  }));

  // Parse JSON bodies with larger limit for document processing
  app.use(json({ 
    limit: '50mb',
    verify: (req: any, res, buf) => {
      req.rawBody = buf; // Save raw body for Stripe webhook verification
    }
  }));

  const server = createServer(app);

  // Setup authentication routes first
  setupAuth(app);

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, {
      query: req.query,
      body: req.body
    });
    next();
  });

  // Mount important routers first
  app.use("/api/payments", paymentsRouter);
  app.use("/api", documentsRouter);
  app.use("/api/metrics", metricsRouter); // Ensure metrics router is properly mounted

  // Mount other API routes
  app.use("/api/legal-research", legalResearchRouter);
  app.use("/api/redline", redlineRouter);
  app.use("/api/vault", vaultRouter);
  app.use("/api/compliance", complianceRouter);
  app.use("/api", reportsRouter);
  app.use("/api/monitoring", predictiveMonitoringRouter);
  app.use("/api/orchestrator", orchestratorRouter);
  app.use("/api/contract-analysis", contractAnalysisRouter);
  app.use("/api/contract-automation", contractAutomationRouter);

  // Add catch-all handler for unmatched API routes
  app.use('/api/*', (req, res) => {
    console.log('[Not Found]', req.method, req.originalUrl);
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      path: req.originalUrl
    });
  });

  return server;
}