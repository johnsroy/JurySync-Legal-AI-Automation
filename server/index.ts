import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { setupAuth } from "./auth";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import cors from 'cors';
import { handleStripeWebhook } from "./webhooks/stripe";
import documentAnalyticsRouter from './routes/document-analytics';
import redlineRouter from "./routes/redline";
import legalResearchRouter from "./routes/legal-research";
import { seedLegalDatabase } from './services/seedData';
import { continuousLearningService } from './services/continuousLearningService';
import passport from 'passport';
import dotenv from 'dotenv';
dotenv.config();

// Create Express application
const app = express();

// Configure API specific middleware FIRST
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? ['https://jurysync.io'] : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON before any routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Enhanced session handling
const PostgresStore = connectPg(session);
const sessionStore = new PostgresStore({
  conObject: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  },
  createTableIfMissing: true,
  pruneSessionInterval: 60,
  tableName: 'session'
});

const sessionMiddleware = session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'development-secret-do-not-use-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  },
  name: 'jurysync.sid'
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// API request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Security headers
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Setup auth
setupAuth(app);

// Mount API routes BEFORE static files
app.use('/api/legal-research', legalResearchRouter);
app.use('/api/document-analytics', documentAnalyticsRouter);
app.use("/api/redline", redlineRouter);

// Register other routes
registerRoutes(app);

// API error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(`API Error [${req.method} ${req.path}]:`, err);

  // Ensure we don't send HTML errors
  res.setHeader('Content-Type', 'application/json');

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'You must be logged in to access this resource'
    });
  }

  return res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Setup Vite or serve static files LAST
if (process.env.NODE_ENV !== "production") {
  setupVite(app);
} else {
  serveStatic(app);
}

// Start server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Initialize services
(async () => {
  try {
    const numberOfDocuments = parseInt(process.env.SEED_DOCUMENTS_COUNT || '500', 10);
    await seedLegalDatabase(numberOfDocuments);
    console.log('Legal database seeded successfully');

    try {
      await continuousLearningService.startContinuousLearning();
      console.log('Continuous learning service started successfully');
    } catch (error) {
      console.error('Failed to start continuous learning service:', error);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running at http://0.0.0.0:${PORT}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();