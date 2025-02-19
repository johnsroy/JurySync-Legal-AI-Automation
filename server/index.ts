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
import { seedLegalDatabase } from './services/seedData';
import { continuousLearningService } from './services/continuousLearningService';
import passport from 'passport';
import dotenv from 'dotenv';
import { seedContractTemplates } from './services/seedContractTemplates';
import contractAutomationRouter from './routes/contract-automation';
import { errorHandler } from './middlewares/errorHandler';

dotenv.config();

// Create Express application
const app = express();

// Configure API specific middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? ['https://jurysync.io'] : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware - increase limit for document processing
app.use(express.json({ limit: '50mb' }));
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
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: 'lax'
  },
  name: 'jurysync.sid'
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// Add proper error handling for passport serialization
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db
      .select()
      .from('users')
      .where('id', '=', id);

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

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    query: req.query,
    body: req.body
  });
  next();
});

// Register all routes
registerRoutes(app);
app.use('/api/contract-automation', contractAutomationRouter);

// API error handling middleware
app.use(errorHandler);

// Setup Vite for development or serve static files for production
if (process.env.NODE_ENV !== "production") {
  setupVite(app);
} else {
  serveStatic(app);
}

// Initialize services and start server
const PORT = process.env.PORT || 5000;

// Start server and initialize services
(async () => {
  try {
    // Set up database and seeding data
    console.log('Setting up database and seeding data...');

    // Seed legal database
    const numberOfDocuments = parseInt(process.env.SEED_DOCUMENTS_COUNT || '500', 10);
    await seedLegalDatabase(numberOfDocuments);
    console.log('Legal database seeded successfully');

    // Seed contract templates
    await seedContractTemplates();
    console.log('Contract templates seeded successfully');

    // Start continuous learning service
    try {
      await continuousLearningService.startContinuousLearning();
      console.log('Continuous learning service started successfully');
    } catch (error) {
      console.error('Failed to start continuous learning service:', error);
    }

    // Start the server
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Server running at http://0.0.0.0:${PORT}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();