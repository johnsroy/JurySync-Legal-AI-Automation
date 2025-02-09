import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { seedLegalDatabase } from './services/seedData';
import cors from 'cors';

const app = express();

// Basic middleware setup
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));

// Configure CORS with proper options
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));

// Initialize session store
const PostgresStore = connectPg(session);
const sessionStore = new PostgresStore({
  conObject: {
    connectionString: process.env.DATABASE_URL,
  },
  createTableIfMissing: true,
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

// Setup security headers with CSP that won't block necessary resources
app.use((req, res, next) => {
  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Content Security Policy adjusted to allow necessary resources
  const cspDirectives = [
    "default-src 'self'",
    "img-src 'self' data: blob: https:",
    "style-src 'self' 'unsafe-inline' https:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "connect-src 'self' ws: wss: http: https:",
    "font-src 'self' data: https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    process.env.NODE_ENV === 'production' ? "upgrade-insecure-requests" : ""
  ].filter(Boolean);

  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  next();
});

// Setup auth before other routes
setupAuth(app);

(async () => {
  try {
    // Seed the legal database with sample data
    await seedLegalDatabase();
    console.log('Legal database seeded successfully');
  } catch (error) {
    console.error('Failed to seed legal database:', error);
  }

  const server = registerRoutes(app);

  // Setup Vite first in development
  if (process.env.NODE_ENV !== "production") {
    try {
      await setupVite(app, server);
      console.log('Vite middleware setup complete');
    } catch (error) {
      console.error('Failed to setup Vite middleware:', error);
      process.exit(1);
    }
  }

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);

    // Check if headers have already been sent
    if (!res.headersSent) {
      const statusCode = err.status || 500;
      const errorMessage = process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error' 
        : (err.message || 'Internal Server Error');

      res.status(statusCode).json({
        error: errorMessage,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
      });
    }
  });

  // Serve static files in production
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  }

  const port = Number(process.env.PORT) || 5000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
  });

})().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});