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
    console.log('Initializing Firebase...');

    // Initialize Firebase collections with retries
    let retries = 3;
    while (retries > 0) {
      try {
        await initializeFirestore();
        console.log('Firebase collections initialized successfully');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.error('Failed to initialize Firebase after retries:', error);
          throw error;
        }
        console.log(`Retrying Firebase initialization... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      }
    }

    try {
      // Register routes
      registerRoutes(app);
      console.log('Routes registered successfully');
    } catch (error) {
      console.error('Failed to register routes:', error);
      throw error;
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