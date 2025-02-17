import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../db";
import { legalResearchReports, legalAnalyses } from "@shared/schema";
import { analyzeLegalDocument } from "../services/legalAnalysisService";

const router = Router();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

router.post("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { query, options } = req.body;

    // Initialize Gemini model
    const model = genAI.getModel("gemini-1.5-pro");
    
    // Structured prompt for better results
    const prompt = `
      Act as a legal research assistant. Analyze the following query and provide comprehensive research results:

      QUERY: ${query}

      Conduct thorough research considering:
      1. Case law and precedents
      2. Statutory regulations
      3. Academic articles and journals
      4. Industry standards and best practices

      Format your response as a JSON object with the following structure:
      {
        "results": [
          {
            "title": "string",
            "source": "string",
            "relevance": number (0-100),
            "summary": "string",
            "citations": ["string"]
          }
        ],
        "recommendations": ["string"]
      }

      Ensure each result includes:
      - Specific case citations where applicable
      - Relevant statutory references
      - Clear summaries of findings
      - Practical recommendations
      
      Make the response detailed but concise, focusing on the most relevant information.
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    
    // Parse and validate the response
    let formattedResults;
    try {
      formattedResults = JSON.parse(response.text());
      // Ensure the response matches our expected structure
      if (!formattedResults.results || !formattedResults.recommendations) {
        throw new Error("Invalid response structure");
      }
    } catch (error) {
      console.error("Failed to parse AI response:", error);
      throw new Error("Failed to generate valid research results");
    }

    // Store in database
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

router.post("/analyze", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: "No document content provided" });
    }

    // Initialize Gemini model
    const model = genAI.getModel("gemini-1.5-pro");
    
    const prompt = `
      Analyze the following legal document and provide a comprehensive legal analysis:

      DOCUMENT:
      ${content}

      Provide a detailed analysis including:
      1. Executive summary (brief overview of key points)
      2. Legal principles identified
      3. Relevant precedents and citations
      4. Specific recommendations
      5. Risk assessment

      Format the response as a JSON object with the following structure:
      {
        "executiveSummary": "string",
        "legalPrinciples": [{
          "principle": "string",
          "explanation": "string",
          "relevance": "string"
        }],
        "precedents": [{
          "case": "string",
          "citation": "string",
          "relevance": "string",
          "holding": "string"
        }],
        "recommendations": [{
          "suggestion": "string",
          "rationale": "string",
          "priority": "HIGH" | "MEDIUM" | "LOW"
        }],
        "riskAreas": [{
          "area": "string",
          "description": "string",
          "severity": "HIGH" | "MEDIUM" | "LOW"
        }]
      }

      Ensure the analysis is thorough, professional, and actionable.
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    
    let analysis;
    try {
      analysis = JSON.parse(response.text());
    } catch (error) {
      throw new Error("Failed to parse analysis results");
    }

    // Store analysis in database
    await db.insert(legalAnalyses).values({
      userId: req.user.id,
      documentContent: content,
      analysis,
      timestamp: new Date(),
    });

    return res.json(analysis);

  } catch (error) {
    console.error("Legal analysis error:", error);
    return res.status(500).json({ error: "Failed to analyze document" });
  }
});

export default router; 