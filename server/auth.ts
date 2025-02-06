import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

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
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: false, // Set to false for development
      sameSite: "lax"
    },
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
    sessionSettings.cookie!.secure = true;
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log('Login attempt for username:', username);
        const user = await storage.getUserByUsername(username);
        if (!user) {
          console.log('User not found:', username);
          return done(null, false, { message: "Invalid username or password" });
        }

        const isValidPassword = await comparePasswords(password, user.password);
        if (!isValidPassword) {
          console.log('Invalid password for user:', username);
          return done(null, false, { message: "Invalid username or password" });
        }

        console.log('Login successful for user:', username);
        return done(null, user);
      } catch (err) {
        console.error('Login error:', err);
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    console.log('Serializing user:', user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('Deserializing user:', id);
      const user = await storage.getUser(id);
      if (!user) {
        console.log('User not found during deserialization:', id);
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      console.error('Deserialization error:', err);
      done(err);
    }
  });

  app.post("/api/register", async (req, res) => {
    try {
      console.log('Registration attempt:', { ...req.body, password: '[REDACTED]' });
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        console.log('Username already exists:', req.body.username);
        return res.status(400).json({ 
          message: "Username already exists",
          code: "USERNAME_EXISTS"
        });
      }

      // Validate user data
      const validatedData = insertUserSchema.parse({
        ...req.body,
        role: "USER" // Default role
      });

      const user = await storage.createUser({
        ...validatedData,
        password: await hashPassword(validatedData.password),
      });

      req.login(user, (err) => {
        if (err) {
          console.error("Login error after registration:", err);
          return res.status(500).json({
            message: "Registration successful but failed to login",
            code: "LOGIN_ERROR"
          });
        }
        console.log('Registration and login successful:', user.username);
        res.status(201).json(user);
      });
    } catch (err) {
      console.error("Registration error:", err);
      if (err instanceof ZodError) {
        return res.status(400).json({
          message: fromZodError(err).message,
          code: "VALIDATION_ERROR"
        });
      }
      res.status(500).json({
        message: "Failed to register user",
        code: "REGISTRATION_ERROR"
      });
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log('Login request received:', { ...req.body, password: '[REDACTED]' });
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({
          message: "Internal server error during login",
          code: "LOGIN_ERROR"
        });
      }

      if (!user) {
        console.log('Authentication failed:', info?.message);
        return res.status(401).json({
          message: info?.message || "Invalid credentials",
          code: "INVALID_CREDENTIALS"
        });
      }

      req.login(user, (err) => {
        if (err) {
          console.error("Session error:", err);
          return res.status(500).json({
            message: "Failed to create session",
            code: "SESSION_ERROR"
          });
        }
        console.log('Login successful:', user.username);
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "You must be logged in to logout",
        code: "NOT_AUTHENTICATED"
      });
    }

    const username = req.user?.username;
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({
          message: "Failed to logout",
          code: "LOGOUT_ERROR"
        });
      }
      console.log('Logout successful:', username);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    console.log('User session check:', req.isAuthenticated() ? 'Authenticated' : 'Not authenticated');
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "You must be logged in to access this resource",
        code: "NOT_AUTHENTICATED"
      });
    }
    res.json(req.user);
  });
}