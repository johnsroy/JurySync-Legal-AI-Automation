import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { setupAuth } from "./auth";
import session from "express-session";
import { storage } from "./storage";
import { initializeFirestore } from './firebase';
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

// Session handling with Firebase session store
app.use(session({
  store: storage.sessionStore,
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Setup auth
setupAuth(app);

// Register document analytics route
app.use('/api/document-analytics', documentAnalyticsRouter);

(async () => {
  try {
    // Initialize Firebase collections
    await initializeFirestore();
    console.log('Firebase collections initialized successfully');

    try {
      // Register routes
      registerRoutes(app);
      console.log('Routes registered successfully');
    } catch (error) {
      console.error('Failed to register routes:', error);
    }

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

    // Start webhook server first
    let webhookPort = 5001;
    while (await isPortInUse(webhookPort)) {
      console.log(`Port ${webhookPort} is in use, trying ${webhookPort + 1}`);
      webhookPort++;
    }
    webhookServer.listen(webhookPort, '0.0.0.0', () => {
      console.log(`Webhook server running at http://0.0.0.0:${webhookPort}`);
    });

    // Setup Vite or serve static files for main application
    if (process.env.NODE_ENV !== "production") {
      await setupVite(app);
      console.log('Vite middleware setup complete');
    } else {
      serveStatic(app);
    }

    // Start main application server
    let mainPort = Number(process.env.PORT) || 5000;
    while (await isPortInUse(mainPort)) {
      console.log(`Port ${mainPort} is in use, trying ${mainPort + 1}`);
      mainPort++;
    }

    app.listen(mainPort, '0.0.0.0', () => {
      console.log(`Main application server running at http://0.0.0.0:${mainPort}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();