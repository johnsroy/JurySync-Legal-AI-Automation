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

// Simple CORS setup for development
app.use(cors());

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

// Setup basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
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

    if (!res.headersSent) {
      res.status(err.status || 500).json({
        error: err.message || "Internal Server Error"
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