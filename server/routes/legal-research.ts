import { Router } from "express";
import { openai } from "../openai";
import { db } from "../db";
import { legalResearchReports, legalAnalyses } from "@shared/schema";
import { generateDeepResearch } from "../services/gemini-service";

const router = Router();

// Generate suggested questions based on filters
router.post("/suggest-questions", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { query, jurisdiction, legalTopic, dateRange } = req.body;

    if (!jurisdiction || !legalTopic) {
      return res.status(400).json({ error: "Missing required filters" });
    }

    // First check if we have cached suggestions
    const cachedSuggestions = await db.query.legalResearchReports.findFirst({
      where: (reports, { and, eq }) => and(
        eq(reports.jurisdiction, jurisdiction),
        eq(reports.legalTopic, legalTopic),
      ),
      orderBy: (reports, { desc }) => [desc(reports.timestamp)],
    });

    if (cachedSuggestions?.suggestions) {
      return res.json(cachedSuggestions.suggestions);
    }

    const dateContext = dateRange.start && dateRange.end
      ? `between ${new Date(dateRange.start).toLocaleDateString()} and ${new Date(dateRange.end).toLocaleDateString()}`
      : "with no specific date range";

    const prompt = `
      As a legal research expert, generate 5 relevant follow-up questions for research in ${jurisdiction} jurisdiction 
      focusing on ${legalTopic} ${dateContext}.

      Original query: "${query || 'No specific query provided'}"

      Consider:
      1. Relevant legal precedents in this jurisdiction
      2. Recent developments in ${legalTopic}
      3. Specific regulations and requirements
      4. Common legal challenges in this area
      5. Industry-specific considerations

      Format the response as a JSON array of strings, where each string is a detailed question.
      The questions should be specific, actionable, and help deepen the legal analysis.

      Example format:
      ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-0125-preview",
      messages: [
        {
          role: "system",
          content: "You are a legal research expert specializing in generating relevant jurisdiction-specific follow-up questions."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const response = JSON.parse(completion.choices[0].message.content);

    // Store suggestions in the knowledge base
    await db.insert(legalResearchReports).values({
      userId: req.user.id,
      jurisdiction,
      legalTopic,
      suggestions: response,
      timestamp: new Date(),
    });

    return res.json(response);

  } catch (error) {
    console.error("Error generating suggested questions:", error);
    return res.status(500).json({ 
      error: "Failed to generate suggestions",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { query, jurisdiction, legalTopic, dateRange, options } = req.body;

    if (!jurisdiction || !legalTopic) {
      return res.status(400).json({ error: "Missing required filters" });
    }

    console.log('Starting legal research:', { query, jurisdiction, legalTopic, dateRange, options });

    let researchResults;

    if (options?.useGemini && options?.deepResearch) {
      // Use Gemini for deep research
      researchResults = await generateDeepResearch(query, jurisdiction, legalTopic, dateRange);
    } else {
      // Use existing OpenAI implementation
      const dateContext = dateRange.start && dateRange.end
        ? `between ${new Date(dateRange.start).toLocaleDateString()} and ${new Date(dateRange.end).toLocaleDateString()}`
        : "with no specific date range";

      const prompt = `
        Act as a legal research assistant specializing in ${jurisdiction} jurisdiction and ${legalTopic}.
        Analyze the following query and provide comprehensive research results ${dateContext}:

        QUERY: ${query}

        Conduct thorough research considering:
        1. Case law and precedents specific to ${jurisdiction}
        2. Statutory regulations in ${legalTopic}
        3. Academic articles and journals
        4. Industry standards and best practices
        5. Recent developments and trends

        Format your response as a JSON object with the following structure:
        {
          "results": [
            {
              "title": "string",
              "source": "string",
              "relevance": number (0-100),
              "summary": "string",
              "citations": ["string"],
              "urls": ["string"] // Include relevant legal resource URLs
            }
          ],
          "recommendations": ["string"]
        }

        Ensure each result includes:
        - Specific case citations relevant to ${jurisdiction}
        - Statutory references for ${legalTopic}
        - URLs to official legal resources and relevant documents
        - Clear summaries of findings
        - Practical recommendations
        ${dateRange.start ? '- Focus on materials within the specified date range' : ''}
      `;

      console.log('Sending request to OpenAI...');
      const completion = await openai.chat.completions.create({
        model: "gpt-4-0125-preview",
        messages: [
          {
            role: "system",
            content: `You are a legal research expert specializing in ${jurisdiction} jurisdiction and ${legalTopic} analysis.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
      });

      console.log('Received response from OpenAI');
      const response = completion.choices[0].message.content;
      let formattedResults;

      try {
        if (!response) {
          throw new Error('Empty response from AI model');
        }
        formattedResults = JSON.parse(response);
        if (!formattedResults.results || !formattedResults.recommendations) {
          throw new Error("Invalid response structure");
        }
      } catch (error) {
        console.error("Failed to parse AI response:", error);
        throw new Error("Failed to generate valid research results");
      }
      researchResults = formattedResults;
    }

    // Store results in knowledge base
    await db.insert(legalResearchReports).values({
      userId: req.user.id,
      query,
      jurisdiction,
      legalTopic,
      dateRange,
      results: researchResults,
      timestamp: new Date(),
    });

    console.log('Research completed successfully');
    return res.json({
      ...researchResults,
      timestamp: new Date(),
    });

  } catch (error) {
    console.error("Legal research error:", error);
    return res.status(500).json({ 
      error: "Failed to complete research",
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router;