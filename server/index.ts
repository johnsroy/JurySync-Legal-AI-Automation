import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { setupAuth } from "./auth";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { seedLegalDatabase } from './services/seedData';
import { continuousLearningService } from './services/continuousLearningService';
import cors from 'cors';
import { handleStripeWebhook } from "./webhooks/stripe";

// Create main application
const app = express();

// Configure API specific middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? ['https://jurysync.io'] : true,
  credentials: true
}));

// Special handling for Stripe webhook endpoints
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
app.post('/api/payments/webhook-test', express.raw({ type: 'application/json' }), (req: Request, res: Response) => {
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    console.log('Webhook test headers:', req.headers);
    console.log('Webhook test body:', req.body.toString());

    return res.status(200).json({ 
      status: 'success',
      message: 'Webhook endpoint is accessible',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Webhook test error:', error);
    return res.status(500).json({ error: 'Webhook test failed' });
  }
});

// Regular JSON parsing for other routes
app.use((req, res, next) => {
  if (req.path === '/api/payments/webhook' || req.path === '/api/payments/webhook-test') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

app.use(express.urlencoded({ extended: false }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Session handling
const PostgresStore = connectPg(session);
const sessionStore = new PostgresStore({
  conObject: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  },
  createTableIfMissing: true,
  pruneSessionInterval: 60
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));

// Setup auth
setupAuth(app);

(async () => {
  try {
    // Database setup
    await seedLegalDatabase();
    console.log('Legal database seeded successfully');

    try {
      await continuousLearningService.startContinuousLearning();
      console.log('Continuous learning service started successfully');
    } catch (error) {
      console.error('Failed to start continuous learning service:', error);
    }

    // Register routes
    registerRoutes(app);

    // API error handling
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      console.error(`API Error [${req.method} ${req.path}]:`, err);

      if (!res.headersSent) {
        const statusCode = err.status || 500;
        const errorMessage = process.env.NODE_ENV === 'production'
          ? 'Internal Server Error'
          : (err.message || 'Internal Server Error');

        res.status(statusCode).json({
          error: errorMessage,
          code: err.code || 'INTERNAL_ERROR',
          ...(process.env.NODE_ENV !== 'production' && {
            stack: err.stack,
            details: err.details || null
          })
        });
      }
    });

    // Setup Vite or serve static files
    if (process.env.NODE_ENV !== "production") {
      await setupVite(app);
      console.log('Vite middleware setup complete');
    } else {
      serveStatic(app);
    }

    // Start main application server
    const port = Number(process.env.PORT) || 5000;
    app.listen(port, '0.0.0.0', () => {
      console.log(`Application server running at http://0.0.0.0:${port}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();