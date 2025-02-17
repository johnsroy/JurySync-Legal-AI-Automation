import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../db";
import { legalResearchReports } from "@shared/schema";

const router = Router();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface ResearchQuery {
  query: string;
  options: {
    useGemini: boolean;
    deepResearch: boolean;
    sources: string[];
  };
}

router.post("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { query, options }: ResearchQuery = req.body;

    // Initialize Gemini model
    const model = genAI.getModel("gemini-1.5-pro");
    
    // Perform the research
    const result = await model.generateContent(`
      Perform a comprehensive legal research analysis on the following query:
      ${query}
      
      Consider the following sources:
      ${options.sources.join(", ")}
      
      Provide:
      1. Relevant case law
      2. Statutory references
      3. Academic articles
      4. Regulatory guidance
      5. Practical recommendations
      
      Format the response as structured JSON with:
      - results (array of findings with title, source, relevance score, and summary)
      - recommendations (array of actionable insights)
    `);

    const response = result.response;
    const formattedResults = JSON.parse(response.text());

    // Store the research results
    await db.insert(legalResearchReports).values({
      userId: req.user.id,
      query,
      results: formattedResults,
      timestamp: new Date(),
    });

    return res.json({
      ...formattedResults,
      timestamp: new Date(),
    });

  } catch (error) {
    console.error("Legal research error:", error);
    return res.status(500).json({ error: "Failed to complete research" });
  }
});

export default router; 