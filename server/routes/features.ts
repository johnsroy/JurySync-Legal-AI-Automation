import { Router } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Check if feature is available for trial
router.get("/check/:feature", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const feature = req.params.feature;
    const validFeatures = ["documentProcessing", "contractAutomation", "complianceAuditing", "legalResearch"];
    
    if (!validFeatures.includes(feature)) {
      return res.status(400).json({ error: "Invalid feature" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id));

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.subscriptionStatus === "ACTIVE") {
      return res.json({ available: true, reason: "subscription" });
    }

    if (user.trialUsesRemaining <= 0) {
      return res.json({ 
        available: false, 
        reason: "noTrialUses",
        subscriptionNeeded: true
      });
    }

    if (user.trialFeatures && user.trialFeatures[feature]) {
      return res.json({ 
        available: false, 
        reason: "featureUsed",
        subscriptionNeeded: true
      });
    }

    return res.json({ 
      available: true, 
      reason: "trial",
      trialUsesRemaining: user.trialUsesRemaining
    });
  } catch (error) {
    console.error("Feature check error:", error);
    return res.status(500).json({ error: "Failed to check feature availability" });
  }
});

// Use a feature in trial mode
router.post("/use/:feature", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const feature = req.params.feature;
    const validFeatures = ["documentProcessing", "contractAutomation", "complianceAuditing", "legalResearch"];
    
    if (!validFeatures.includes(feature)) {
      return res.status(400).json({ error: "Invalid feature" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id));

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // For subscribed users, just allow usage
    if (user.subscriptionStatus === "ACTIVE") {
      return res.json({ success: true, reason: "subscription" });
    }

    // Check if user has trial uses remaining
    if (user.trialUsesRemaining <= 0) {
      return res.status(403).json({ 
        error: "No trial uses remaining",
        subscriptionNeeded: true
      });
    }

    // Check if feature already used
    if (user.trialFeatures && user.trialFeatures[feature]) {
      return res.status(403).json({ 
        error: "Feature already used in trial",
        subscriptionNeeded: true
      });
    }

    // Update user's trial feature usage
    const updatedFeatures = { ...user.trialFeatures, [feature]: true };
    
    await db
      .update(users)
      .set({
        trialFeatures: updatedFeatures,
        trialUsesRemaining: user.trialUsesRemaining - 1,
        updatedAt: new Date()
      })
      .where(eq(users.id, req.user.id));

    return res.json({ 
      success: true, 
      trialUsesRemaining: user.trialUsesRemaining - 1,
      message: "Feature used successfully in trial mode"
    });
  } catch (error) {
    console.error("Feature use error:", error);
    return res.status(500).json({ error: "Failed to use feature" });
  }
});

export default router; 