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
import { createServer } from 'net';
import { handleStripeWebhook } from "./webhooks/stripe";
import documentAnalyticsRouter from './routes/document-analytics';

async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        server.once('close', () => resolve(false)).close();
      })
      .listen(port, '0.0.0.0');
  });
}

// Create a separate webhook server
const webhookServer = express();
webhookServer.use(cors());
webhookServer.use(express.raw({ type: 'application/json' }));

// Configure webhook routes
webhookServer.post('/webhook', handleStripeWebhook);
webhookServer.post('/webhook-test', (req: Request, res: Response) => {
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    console.log('Headers:', req.headers);
    console.log('Body:', req.body);

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

// Create main application
const app = express();

// Configure API specific middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? ['https://jurysync.io'] : true,
  credentials: true
}));

app.use(express.json());
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
  secret: process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'development-secret'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET must be set in production environment');
}

// Setup auth
setupAuth(app);

// Register document analytics route
app.use('/api/document-analytics', documentAnalyticsRouter);

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

    const mainPort = process.env.PORT || 3000;
    const webhookPort = process.env.REPLIT_DEPLOYMENT ? mainPort : 5001;

    if (!process.env.REPLIT_DEPLOYMENT) {
      // Only start separate webhook server in development
      webhookServer.listen(webhookPort, '0.0.0.0', () => {
        console.log(`Webhook server running at http://0.0.0.0:${webhookPort}`);
      });
    } else {
      // In production, add webhook routes to main app
      app.use('/webhook', webhookServer);
    }

    // Setup Vite or serve static files for main application
    if (process.env.NODE_ENV !== "production") {
      await setupVite(app);
      console.log('Vite middleware setup complete');
    } else {
      serveStatic(app);
    }

    // Start main application server
    app.listen(mainPort, '0.0.0.0', () => {
      console.log(`Main application server running at http://0.0.0.0:${mainPort}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();