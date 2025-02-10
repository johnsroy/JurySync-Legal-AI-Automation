import OpenAI from "openai";
import { db } from "../db";
import { modelMetrics } from "@shared/schema/metrics";
import { performance } from "perf_hooks";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Model configurations
const MODELS = {
  GPT4O: "gpt-4o", // Latest model for general tasks
  GPT4: "gpt-4", // For research and analytics
  GPT3_16K: "gpt-3.5-turbo-16k", // For longer context
  GPT3: "gpt-3.5-turbo", // For routine tasks
} as const;

interface TaskAnalysis {
  complexity: number; // 0-1 score
  requiresCode: boolean;
  requiresMath: boolean;
  contextLength: number;
  predictedTokens: number;
}

interface ModelRoutingResult {
  modelUsed: string;
  processingTimeMs: number;
  qualityScore: number;
  output: string;
  metadata: Record<string, any>;
}

export class ModelRouter {
  private async analyzeTask(text: string): Promise<TaskAnalysis> {
    try {
      const response = await openai.chat.completions.create({
        model: MODELS.GPT3,
        messages: [
          {
            role: "system",
            content: "Analyze the following task and return a JSON object with these properties: complexity (0-1), requiresCode (boolean), requiresMath (boolean), contextLength (number), predictedTokens (number)."
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
        predictedTokens: analysis.predictedTokens || 0
      };
    } catch (error) {
      console.error("Error analyzing task:", error);
      throw new Error("Failed to analyze task");
    }
  }

  private selectModel(analysis: TaskAnalysis): string {
    if (analysis.complexity > 0.7 && (analysis.requiresCode || analysis.requiresMath)) {
      return MODELS.GPT4O;
    } else if (analysis.complexity > 0.5) {
      return MODELS.GPT4;
    } else if (analysis.contextLength > 4000) {
      return MODELS.GPT3_16K;
    } else {
      return MODELS.GPT3;
    }
  }

  private async logMetrics(
    taskId: string,
    modelUsed: string,
    taskType: string,
    processingTimeMs: number,
    tokenCount: number,
    qualityScore: number,
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
      const completion = await openai.chat.completions.create({
        model: selectedModel,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content
          }
        ],
        temperature: 0.7,
      });

      const processingTimeMs = Math.round(performance.now() - startTime);
      const output = completion.choices[0].message.content || "";
      
      // Calculate quality score (simplified version)
      const qualityScore = 0.8; // This should be replaced with actual quality assessment
      
      // Log metrics
      await this.logMetrics(
        taskId,
        selectedModel,
        taskType,
        processingTimeMs,
        completion.usage?.total_tokens || 0,
        qualityScore,
        {
          analysis,
          completionId: completion.id,
          temperature: 0.7
        }
      );

      return {
        modelUsed: selectedModel,
        processingTimeMs,
        qualityScore,
        output,
        metadata: {
          analysis,
          tokenUsage: completion.usage
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
        {
          error: error instanceof Error ? error.message : "Unknown error",
          analysis: null
        }
      );
      
      throw error;
    }
  }

  public async getMetrics(taskId?: string) {
    try {
      const query = db.select().from(modelMetrics);
      if (taskId) {
        query.where({ taskId });
      }
      return await query.execute();
    } catch (error) {
      console.error("Error fetching metrics:", error);
      throw new Error("Failed to fetch metrics");
    }
  }
}

// Export singleton instance
export const modelRouter = new ModelRouter();
