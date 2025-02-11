import OpenAI from "openai";
import { db } from "../db";
import { modelMetrics } from "@shared/schema/metrics";
import { performance } from "perf_hooks";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from 'drizzle-orm';

// Initialize API clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Model configurations with costs and capabilities
const MODELS = {
  O3_HIGH: {
    id: "claude-3-opus-20240229",
    provider: "anthropic",
    capabilities: {
      complexCode: true,
      math: true,
      contextLength: 200000,
      costPer1kTokens: 0.015
    }
  },
  GPT4O: {
    id: "gpt-4o",
    provider: "openai",
    capabilities: {
      research: true,
      analysis: true,
      contextLength: 128000,
      costPer1kTokens: 0.01
    }
  },
  O3_MINI: {
    id: "claude-3-sonnet-20240229",
    provider: "anthropic", 
    capabilities: {
      routineCode: true,
      contextLength: 100000,
      costPer1kTokens: 0.003
    }
  },
  O1: {
    id: "claude-instant-1.2",
    provider: "anthropic",
    capabilities: {
      basicMath: true,
      simpleCode: true,
      contextLength: 100000,
      costPer1kTokens: 0.0008
    }
  }
} as const;

interface TaskAnalysis {
  complexity: number; // 0-1 score
  requiresCode: boolean;
  requiresMath: boolean;
  contextLength: number;
  predictedTokens: number;
  keywords: string[];
}

interface ModelRoutingResult {
  modelUsed: string;
  processingTimeMs: number;
  qualityScore: number;
  output: string;
  metadata: Record<string, any>;
  errorRate: number;
}

export class ModelRouter {
  private async analyzeTask(text: string): Promise<TaskAnalysis> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Analyze the following task and return a JSON object with these properties:
              - complexity (0-1): How complex is the task?
              - requiresCode (boolean): Does it need code generation?
              - requiresMath (boolean): Does it need mathematical computation?
              - contextLength (number): Estimated context length needed
              - predictedTokens (number): Estimated tokens needed
              - keywords (array): Important task-related keywords
              Base the analysis on technical terms, mathematical symbols, and code-related content.`
          },
          {
            role: "user",
            content: text
          }
        ],
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content || "{}");
      return {
        complexity: analysis.complexity || 0,
        requiresCode: analysis.requiresCode || false,
        requiresMath: analysis.requiresMath || false,
        contextLength: analysis.contextLength || 0,
        predictedTokens: analysis.predictedTokens || 0,
        keywords: analysis.keywords || []
      };
    } catch (error) {
      console.error("Error analyzing task:", error);
      throw new Error("Failed to analyze task");
    }
  }

  private selectModel(analysis: TaskAnalysis): string {
    // Complex code or math tasks -> O3_HIGH
    if (analysis.complexity > 0.7 && (analysis.requiresCode || analysis.requiresMath)) {
      return MODELS.O3_HIGH.id;
    }

    // Research and analysis tasks -> GPT4O
    if (analysis.complexity > 0.5 || analysis.keywords.some(k => 
      ['research', 'analyze', 'summarize', 'compare'].includes(k.toLowerCase()))) {
      return MODELS.GPT4O.id;
    }

    // Routine coding tasks -> O3_MINI
    if (analysis.requiresCode && analysis.complexity <= 0.7) {
      return MODELS.O3_MINI.id;
    }

    // Basic math and simple operations -> O1
    return MODELS.O1.id;
  }

  private async processWithModel(
    model: string,
    content: string,
    systemPrompt: string
  ): Promise<string> {
    const modelConfig = Object.values(MODELS).find(m => m.id === model);
    if (!modelConfig) throw new Error("Invalid model selected");

    if (modelConfig.provider === "anthropic") {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: systemPrompt },
            { type: "text", text: content }
          ]
        }]
      });
      return response.content[0].value;
    } else {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content }
        ]
      });
      return response.choices[0].message.content || "";
    }
  }

  private async logMetrics(
    taskId: string,
    modelUsed: string,
    taskType: string,
    processingTimeMs: number,
    tokenCount: number,
    qualityScore: number,
    errorRate: number,
    metadata: Record<string, any>
  ) {
    try {
      await db.insert(modelMetrics).values({
        taskId,
        modelUsed,
        taskType,
        processingTimeMs,
        tokenCount,
        qualityScore,
        errorRate,
        metadata: JSON.stringify(metadata)
      });
    } catch (error) {
      console.error("Error logging metrics:", error);
    }
  }

  public async processTask(
    taskId: string,
    taskType: string,
    content: string,
    systemPrompt: string
  ): Promise<ModelRoutingResult> {
    const startTime = performance.now();

    try {
      // Analyze task complexity and requirements
      const analysis = await this.analyzeTask(content);

      // Select appropriate model
      const selectedModel = this.selectModel(analysis);

      // Process with selected model
      const output = await this.processWithModel(selectedModel, content, systemPrompt);

      const processingTimeMs = Math.round(performance.now() - startTime);

      // Calculate quality score based on output consistency and task requirements
      const qualityScore = await this.calculateQualityScore(output, analysis);

      // Calculate error rate
      const errorRate = await this.calculateErrorRate(output, analysis) || 0;

      // Log metrics
      await this.logMetrics(
        taskId,
        selectedModel,
        taskType,
        processingTimeMs,
        analysis.predictedTokens,
        qualityScore,
        errorRate,
        {
          analysis,
          modelDetails: MODELS[selectedModel as keyof typeof MODELS]
        }
      );

      return {
        modelUsed: selectedModel,
        processingTimeMs,
        qualityScore,
        output,
        errorRate,
        metadata: {
          analysis,
          tokenUsage: analysis.predictedTokens,
          modelCapabilities: MODELS[selectedModel as keyof typeof MODELS].capabilities
        }
      };
    } catch (error) {
      const processingTimeMs = Math.round(performance.now() - startTime);
      console.error("Error processing task:", error);

      // Log error metrics
      await this.logMetrics(
        taskId,
        "error",
        taskType,
        processingTimeMs,
        0,
        0,
        1,
        {
          error: error instanceof Error ? error.message : "Unknown error",
          analysis: null
        }
      );

      throw error;
    }
  }

  private async calculateQualityScore(output: string, analysis: TaskAnalysis): Promise<number> {
    // Implement quality scoring based on output characteristics
    const hasExpectedLength = output.length > 100;
    const hasStructuredFormat = output.includes("{") && output.includes("}");
    const meetsComplexityRequirements = analysis.complexity > 0.5 ? 
      output.length > 500 : output.length > 200;

    let score = 0;
    score += hasExpectedLength ? 0.3 : 0;
    score += hasStructuredFormat ? 0.3 : 0;
    score += meetsComplexityRequirements ? 0.4 : 0;

    return score;
  }

  private async calculateErrorRate(output: string, analysis: TaskAnalysis): Promise<number> {
    if (!analysis.requiresCode) return 0;

    // Basic error detection for code outputs
    const errorIndicators = [
      "error",
      "exception",
      "invalid",
      "failed",
      "undefined is not"
    ];

    const errorCount = errorIndicators.reduce((count, indicator) => 
      count + (output.toLowerCase().includes(indicator) ? 1 : 0), 0);

    return errorCount / errorIndicators.length;
  }

  public async getMetrics(taskId?: string) {
    try {
      const query = db.select().from(modelMetrics);
      if (taskId) {
        query.where(eq(modelMetrics.taskId, taskId));
      }
      return await query.execute();
    } catch (error) {
      console.error("Error fetching metrics:", error);
      throw new Error("Failed to fetch metrics");
    }
  }

  public async getPerformanceMetrics() {
    try {
      const metrics = await db.select().from(modelMetrics).execute();

      // Calculate automation rate
      const totalTasks = metrics.length;
      const automatedTasks = metrics.filter(m => m.errorRate < 0.2).length;
      const automationRate = (automatedTasks / totalTasks) * 100;

      // Calculate processing time reduction
      const avgProcessingTime = metrics.reduce((sum, m) => sum + m.processingTimeMs, 0) / totalTasks;
      const baselineProcessingTime = 300000; // 5 minutes baseline
      const processingTimeReduction = ((baselineProcessingTime - avgProcessingTime) / baselineProcessingTime) * 100;

      // Calculate error reduction
      const avgErrorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / totalTasks;
      const baselineErrorRate = 0.4; // 40% baseline error rate
      const errorReduction = ((baselineErrorRate - avgErrorRate) / baselineErrorRate) * 100;

      // Calculate labor cost savings
      const laborCostSavings = (automationRate * 0.5); // Conservative estimate

      return {
        automationRate,
        processingTimeReduction,
        errorReduction,
        laborCostSavings,
        metrics: {
          totalTasks,
          avgProcessingTime,
          avgErrorRate,
          automatedTasks
        }
      };
    } catch (error) {
      console.error("Error calculating performance metrics:", error);
      throw new Error("Failed to calculate performance metrics");
    }
  }
}

// Export singleton instance
export const modelRouter = new ModelRouter();