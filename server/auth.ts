import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import debug from "debug";

const log = debug("app:auth");
const scryptAsync = promisify(scrypt);

// Configure passport serialization
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    done(null, user);
  } catch (err) {
    done(err);
  }
});

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Session configuration
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "development-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport with local strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        log("Attempting authentication for user:", username);
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username));

        if (!user) {
          log("User not found:", username);
          return done(null, false, { message: "Invalid username or password" });
        }

        const isValidPassword = await comparePasswords(password, user.password);
        if (!isValidPassword) {
          log("Invalid password for user:", username);
          return done(null, false, { message: "Invalid username or password" });
        }

        log("Authentication successful for user:", username);
        return done(null, user);
      } catch (err) {
        log("Authentication error:", err);
        return done(err);
      }
    })
  );

  // Authentication routes
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        log("Login error:", err);
        return res.status(500).json({
          success: false,
          error: "Internal server error during login"
        });
      }

      if (!user) {
        log("Login failed:", info?.message);
        return res.status(401).json({
          success: false,
          error: info?.message || "Invalid credentials"
        });
      }

      req.login(user, (err) => {
        if (err) {
          log("Session creation error:", err);
          return res.status(500).json({
            success: false,
            error: "Failed to create session"
          });
        }

        log("Login successful for user:", user.username);
        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          }
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, email } = req.body;

      // Check if username exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username));

      if (existingUser) {
        log("Registration failed - username exists:", username);
        return res.status(400).json({
          success: false,
          error: "Username already exists"
        });
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(password);
      const [user] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          email,
          role: 'USER'
        })
        .returning();

      log("Registration successful for user:", username);
      res.status(201).json({
        success: true,
        message: "Registration successful"
      });
    } catch (error) {
      log("Registration error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to register user"
      });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    const username = (req.user as any)?.username;
    req.logout((err) => {
      if (err) {
        log("Logout error:", err);
        return res.status(500).json({
          success: false,
          error: "Failed to logout"
        });
      }
      log("Logout successful for user:", username);
      res.json({ success: true });
    });
  });

  app.get("/api/auth/session", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated"
      });
    }
    res.json({ 
      success: true, 
      user: {
        id: (req.user as any).id,
        username: (req.user as any).username,
        email: (req.user as any).email,
        role: (req.user as any).role
      }
    });
  });
}