import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { setupAuth } from "./auth";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import cors from 'cors';
import debug from 'debug';

const log = debug('jurysync:server');

// Create Express application
const app = express();

// Log startup time
const startTime = Date.now();
log('Starting server initialization...');

try {
  // Configure API specific middleware
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? ['https://jurysync.io'] : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature']
  }));

  // Body parsing middleware
  app.use(express.json({ 
    limit: '50mb',
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    }
  }));
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

  app.use(session({
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
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  // Add proper error handling for passport serialization
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id));

      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error('User deserialization error:', error);
      done(error, null);
    }
  });

  // Security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Setup authentication
  setupAuth(app);

  // Register all routes
  const server = registerRoutes(app);

  // Setup Vite for development or serve static files for production
  if (process.env.NODE_ENV !== "production") {
    setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Start the server
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => {
    log(`Server running at http://0.0.0.0:${PORT} (startup time: ${Date.now() - startTime}ms)`);
  });

} catch (error) {
  log('Critical error during server startup:', error);
  if (error instanceof Error) {
    log('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }
  process.exit(1);
}

// Initialize services and start server

// Start server and initialize services
(async () => {
  try {
    log('Core initialization completed in %dms', Date.now() - startTime);

    // Initialize background tasks after server is running
    setTimeout(async () => {
      try {
        log('Starting background initialization...');

        // Seed legal database
        try {
          const numberOfDocuments = parseInt(process.env.SEED_DOCUMENTS_COUNT || '500', 10);
          await seedLegalDatabase(numberOfDocuments);
          log('Legal database seeded successfully');
        } catch (seedError) {
          log('Warning: Legal database seeding failed:', seedError);
        }

        // Seed contract templates
        try {
          await seedContractTemplates();
          log('Contract templates seeded successfully');
        } catch (templateError) {
          log('Warning: Contract template seeding failed:', templateError);
        }

        // Start continuous learning service
        try {
          await continuousLearningService.startContinuousLearning();
          log('Continuous learning service started successfully');
        } catch (learningError) {
          log('Warning: Failed to start continuous learning service:', learningError);
        }

        log('Background initialization completed (took %dms)', Date.now() - startTime);
      } catch (error) {
        log('Warning: Background initialization failed:', error);
      }
    }, 2000); // Run background tasks after 2 seconds

  } catch (error) {
    console.error('Critical error starting server:', error);
    process.exit(1);
  }
})();

import passport from 'passport';
import dotenv from 'dotenv';
import { seedContractTemplates } from './services/seedContractTemplates';
import contractAutomationRouter from './routes/contract-automation';
import { errorHandler } from './middlewares/errorHandler';
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import paymentsRouter from './routes/payments';
import { seedLegalDatabase } from './services/seedData';
import { continuousLearningService } from './services/continuousLearningService';
import documentAnalyticsRouter from './routes/document-analytics';
import redlineRouter from "./routes/redline";
import { handleStripeWebhook } from "./webhooks/stripe";


dotenv.config();