import { Express } from 'express';
import authRouter from './auth';
import paymentsRouter from './payments';
import contractAutomationRouter from './contract-automation';
import workflowAutomationRouter from './workflow-automation';
// ... other imports

export function registerRoutes(app: Express) {
  // Public routes
  app.use('/api/auth', authRouter);
  app.use('/api/payments', paymentsRouter);
  
  // Protected routes
  app.use('/api/contract-automation', contractAutomationRouter);
  app.use('/api/workflow-automation', workflowAutomationRouter);
  // ... other routes
  
  return app;
} 