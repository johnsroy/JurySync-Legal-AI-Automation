import { Router } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import debug from "debug";

const log = debug("app:auth");
const router = Router();

// Register endpoint
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Input validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: username, email, and password are required"
      });
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format"
      });
    }
    
    // Password strength check
    if (password.length < 6) {
      return res.status(400).json({
        success: false, 
        error: "Password must be at least 6 characters long"
      });
    }
    
    // Check if user already exists
    const existingUser = await db.select().from(users).where(users.email.equals(email));
    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        error: "User with this email already exists"
      });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create new user
    const [newUser] = await db.insert(users)
      .values({
        username,
        email,
        passwordHash: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      process.env.JWT_SECRET || "fallback-secret-key",
      { expiresIn: "24h" }
    );
    
    // Return success with token
    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      }
    });
    
  } catch (error) {
    log("Registration error:", error);
    return res.status(500).json({
      success: false,
      error: "Registration failed. Please try again."
    });
  }
});

// Login endpoint
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Input validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required"
      });
    }
    
    // Find user by email
    const [user] = await db.select().from(users).where(users.email.equals(email));
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials"
      });
    }
    
    // Check password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials"
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || "fallback-secret-key",
      { expiresIn: "24h" }
    );
    
    // Return success with token
    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
    
  } catch (error) {
    log("Login error:", error);
    return res.status(500).json({
      success: false,
      error: "Login failed. Please try again."
    });
  }
});

// Add aliases at the router level
const aliasRouter = Router();
aliasRouter.post("/register", (req, res) => router.handle(req, res));
aliasRouter.post("/login", (req, res) => router.handle(req, res));

export { aliasRouter };

// Export the router as default
export default router; 