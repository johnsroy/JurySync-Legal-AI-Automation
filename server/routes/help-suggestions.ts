import { Router } from "express";
import { z } from "zod";
import Anthropic from '@anthropic-ai/sdk';
import { db } from "../db";

const router = Router();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Validation schema for help context
const contextSchema = z.object({
  context: z.string().min(1)
});

// Cache for storing recent suggestions
const suggestionCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

router.get("/suggestions", async (req, res) => {
  try {
    const { context } = contextSchema.parse(req.query);

    // Check cache first
    const cached = suggestionCache.get(context);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.json(cached.data);
    }

    // Generate contextual help using Claude
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `Generate a helpful tooltip suggestion for a legal document management system. Context: "${context}". 
                  Format response as JSON with 'title' (short), 'content' (1-2 sentences), and 'priority' (low/medium/high).
                  Keep it concise and professional.`
      }]
    });

    // Parse the response safely
    let suggestion;
    if (message.content && message.content[0] && 'text' in message.content[0]) {
      suggestion = JSON.parse(message.content[0].text);
    } else {
      throw new Error("Invalid response from AI service");
    }

    // Cache the result
    suggestionCache.set(context, {
      data: suggestion,
      timestamp: Date.now()
    });

    res.json(suggestion);
  } catch (error) {
    console.error("Error generating help suggestion:", error);
    res.status(500).json({ 
      error: "Failed to generate help suggestion",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;