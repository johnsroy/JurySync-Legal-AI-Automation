import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { seedLegalDatabase } from './services/seedData';
import { continuousLearningService } from './services/continuousLearningService';
import cors from 'cors';
import { createServer } from 'net';

// Helper function to check if port is in use
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

// Increase JSON payload limit for large documents
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));

// Configure CORS with specific options
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://jurysync.io'] // Replace with actual production domain
    : true, // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 600 // Cache preflight requests for 10 minutes
}));

// Initialize session store with retry logic
const PostgresStore = connectPg(session);
const sessionStore = new PostgresStore({
  conObject: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  },
  createTableIfMissing: true,
  pruneSessionInterval: 60
});

const sessionSecret = process.env.SESSION_SECRET || process.env.REPL_ID || 'your-session-secret';

app.use(session({
  store: sessionStore,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: 'lax'
  },
}));

// Security headers with relaxed CSP for development
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Add request logging for API routes
  if (req.path.startsWith('/api/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }

  // Add better error handling middleware
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Setup auth before other routes
setupAuth(app);

(async () => {
  try {
    // Check if port 5000 is in use and find an available port
    let port = Number(process.env.PORT) || 5000;
    while (await isPortInUse(port)) {
      console.log(`Port ${port} is in use, trying ${port + 1}`);
      port++;
    }

    // Initialize database and seed data
    await seedLegalDatabase();
    console.log('Legal database seeded successfully');

    // Start continuous learning service
    try {
      await continuousLearningService.startContinuousLearning();
      console.log('Continuous learning service started successfully');
    } catch (error) {
      console.error('Failed to start continuous learning service:', error);
      // Continue app startup even if continuous learning fails
    }

    // Register API routes first
    const server = registerRoutes(app);

    // Enhanced error handling middleware for API routes
    app.use('/api', (err: any, req: Request, res: Response, next: NextFunction) => {
      console.error(`API Error [${req.method} ${req.path}]:`, err);

      if (!res.headersSent) {
        const statusCode = err.status || 500;
        const errorMessage = process.env.NODE_ENV === 'production' 
          ? 'Internal Server Error' 
          : (err.message || 'Internal Server Error');

        // Send detailed error response
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

    // Setup Vite after API routes in development
    if (process.env.NODE_ENV !== "production") {
      try {
        await setupVite(app, server);
        console.log('Vite middleware setup complete');
      } catch (error) {
        console.error('Failed to setup Vite middleware:', error);
        process.exit(1);
      }
    }

    // Serve static files in production
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    }

    server.listen(port, '0.0.0.0', () => {
      console.log(`Server running at http://0.0.0.0:${port}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});