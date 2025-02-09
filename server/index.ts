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

// Enable CORS with proper configuration
app.use(cors({
  origin: ["http://localhost:5000", "http://0.0.0.0:5000"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Initialize session store with proper configuration
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

// Add security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Add a middleware to ensure JSON responses for API routes
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  log(`${req.method} ${req.url} - Starting request`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    log(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
  });

  next();
});

// Setup auth before routes
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

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);

    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(413).json({ error: 'Too many files' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Invalid file type' });
      }

      res.status(status).json({ error: message });
    }
  });

  // Setup vite or serve static files based on environment
  if (process.env.NODE_ENV !== "production") {
    try {
      await setupVite(app, server);
      console.log('Vite middleware setup complete');
    } catch (error) {
      console.error('Failed to setup Vite middleware:', error);
      process.exit(1);
    }
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT) || 5000;

  // Bind to 0.0.0.0 to make the server accessible
  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
  }).on('error', (error: NodeJS.ErrnoException) => {
    console.error('Server error:', error);
    process.exit(1);
  });

})().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});