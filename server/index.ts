import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { seedLegalDatabase } from './services/seedData';

const app = express();
// Increased limit for file uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));

// Initialize session store
const PostgresStore = connectPg(session);
const sessionStore = new PostgresStore({
  conObject: {
    connectionString: process.env.DATABASE_URL,
  },
  createTableIfMissing: true,
});

// Use REPL_OWNER or REPL_ID as fallback for session secret
const sessionSecret = process.env.SESSION_SECRET || process.env.REPL_ID || 'your-session-secret';

app.use(session({
  store: sessionStore,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  },
}));

// Add a middleware to ensure JSON responses for API routes
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Setup auth before routes
setupAuth(app);

(async () => {
  try {
    // Initialize core application
    const server = registerRoutes(app);

    // Start server before other initializations
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`serving on port ${PORT}`);
    });

    // Initialize non-critical components after server starts
    try {
      // Seed the legal database with sample data
      await seedLegalDatabase();
      console.log('Legal database seeded successfully');
    } catch (error) {
      console.error('Failed to seed legal database:', error);
      // Continue app execution even if seeding fails
    }

    // Error handling middleware - ensure JSON responses
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);

      // Ensure we haven't sent headers yet
      if (!res.headersSent) {
        // Force content type to be JSON
        res.setHeader('Content-Type', 'application/json');

        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";

        // Handle multer errors specifically
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

    // Setup vite in development after core app is running
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();