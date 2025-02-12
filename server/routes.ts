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
import reportsRouter from "./routes/reports";
import cors from 'cors';
import { json } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

// ES modules dirname configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // API Routes
  app.use("/api/legal", legalResearchRouter);
  app.use("/api/compliance", complianceRouter);
  app.use("/api/metrics", metricsRouter);
  app.use("/api", reportsRouter);
  app.use("/api/monitoring", predictiveMonitoringRouter);
  app.use("/api/orchestrator", orchestratorRouter);
  app.use("/api/contract-analysis", contractAnalysisRouter);
  app.use(documentsRouter);

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

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../dist')));
  }

  // Handle client-side routing - must be after API routes
  app.get('*', (req, res) => {
    // Don't handle API routes here
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }

    // Serve index.html for client routes
    res.sendFile(path.join(__dirname, '../dist/index.html'));
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