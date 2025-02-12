import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { setupAuth } from "./auth";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import cors from 'cors';
import { handleStripeWebhook } from "./webhooks/stripe";

// Create main application
const app = express();

// Configure API specific middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? ['https://jurysync.io'] : true,
  credentials: true
}));

// Important: Configure webhook endpoint before JSON parsing middleware
// This ensures we get the raw body for webhook signature verification
app.post('/api/payments/webhook', 
  express.raw({ type: 'application/json' }), 
  handleStripeWebhook
);

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
    // Register routes for API paths first
    app.use('/api', express.json(), express.urlencoded({ extended: false }));
    registerRoutes(app);

    // API error handling
    app.use('/api', (err: any, req: Request, res: Response, next: NextFunction) => {
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

    // Setup Vite or serve static files for non-API paths
    if (process.env.NODE_ENV !== "production") {
      // Pass app instance to setupVite
      await setupVite(app, {
        server: { middlewareMode: true }
      });
      console.log('Vite middleware setup complete');
    } else {
      serveStatic(app);
    }

    // Start application server
    const port = Number(process.env.PORT) || 5000;
    app.listen(port, '0.0.0.0', () => {
      console.log(`Application server running at http://0.0.0.0:${port}`);
      console.log(`Stripe webhook endpoint: http://0.0.0.0:${port}/api/payments/webhook`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();