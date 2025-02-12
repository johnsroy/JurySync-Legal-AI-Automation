import OpenAI from "openai";
import { db } from '../db';
import { 
  regulatoryUpdates, 
  caseLawUpdates, 
  continuousLearningUpdates,
  type RegulatoryUpdate,
  type CaseLawUpdate as CaseLawUpdateWithFullText
} from '@shared/schema';
import { eq, and, lte, sql } from 'drizzle-orm';
import { chromaStore } from './chromaStore';

function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ContinuousLearning] [${type.toUpperCase()}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.");
}

const openai = new OpenAI();

export class ContinuousLearningService {
  private static instance: ContinuousLearningService;
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL = 3600000; // 1 hour in milliseconds

  private constructor() {
    log('Initializing ContinuousLearningService');
  }

  static getInstance(): ContinuousLearningService {
    if (!ContinuousLearningService.instance) {
      ContinuousLearningService.instance = new ContinuousLearningService();
    }
    return ContinuousLearningService.instance;
  }

  async startContinuousLearning() {
    try {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
      }

      // Initial update
      await this.performUpdate();

      // Schedule regular updates
      this.updateInterval = setInterval(async () => {
        await this.performUpdate();
      }, this.UPDATE_INTERVAL);

      log('Continuous learning system started');
    } catch (error) {
      log('Failed to start continuous learning service', 'error', error);
      throw error;
    }
  }

  private async performUpdate() {
    try {
      log('Starting periodic update');

      // Process regulatory updates
      const regulatoryResults = await this.processRegulatoryUpdates();

      // Process case law updates
      const caseLawResults = await this.processCaseLawUpdates();

      // Update model context parameters
      const modelUpdates = await this.updateModelParameters(regulatoryResults.concat(caseLawResults));

      // Log the update summary
      const updateSummary = {
        timestamp: new Date().toISOString(),
        regulatoryUpdatesProcessed: regulatoryResults.length,
        caseLawUpdatesProcessed: caseLawResults.length,
        modelParametersUpdated: modelUpdates.length,
        nextUpdateDue: new Date(Date.now() + this.UPDATE_INTERVAL).toISOString()
      };

      log('Update complete', 'info', updateSummary);

      return updateSummary;
    } catch (error) {
      log('Update failed', 'error', error);
      throw error;
    }
  }

  private async processRegulatoryUpdates(): Promise<RegulatoryUpdate[]> {
    try {
      const updates = await db
        .select()
        .from(regulatoryUpdates)
        .where(
          and(
            sql`NOT EXISTS (
              SELECT 1 FROM ${continuousLearningUpdates} 
              WHERE ${continuousLearningUpdates.updateType} = 'REGULATORY' 
              AND ${continuousLearningUpdates.updateId} = ${regulatoryUpdates.id}
            )`,
            lte(regulatoryUpdates.effectiveDate, new Date())
          )
        );

      for (const update of updates) {
        try {
          const vectorResponse = await chromaStore.addDocument({
            id: update.id.toString(),
            content: update.content,
            metadata: {
              type: 'regulatory',
              jurisdiction: update.jurisdiction,
              effectiveDate: update.effectiveDate?.toISOString(),
              source: update.source
            }
          });

          await db
            .insert(continuousLearningUpdates)
            .values({
              updateType: 'REGULATORY',
              updateId: update.id,
              processingStatus: 'COMPLETED',
              vectorEmbeddingId: vectorResponse.id,
              contextParameters: {
                jurisdiction: update.jurisdiction,
                effectiveDate: update.effectiveDate,
                type: update.type
              }
            });

        } catch (error) {
          log('Failed to process regulatory update', 'error', {
            updateId: update.id,
            error
          });
        }
      }

      return updates;
    } catch (error) {
      log('Regulatory updates processing failed', 'error', error);
      throw error;
    }
  }

  private async processCaseLawUpdates(): Promise<CaseLawUpdateWithFullText[]> {
    try {
      const updates = await db
        .select()
        .from(caseLawUpdates)
        .where(
          and(
            sql`NOT EXISTS (
              SELECT 1 FROM ${continuousLearningUpdates} 
              WHERE ${continuousLearningUpdates.updateType} = 'CASE_LAW' 
              AND ${continuousLearningUpdates.updateId} = ${caseLawUpdates.id}
            )`,
            lte(caseLawUpdates.decisionDate, new Date())
          )
        );

      for (const update of updates) {
        try {
          const vectorResponse = await chromaStore.addDocument({
            id: update.id.toString(),
            content: update.full_text,
            metadata: {
              type: 'case_law',
              court: update.court,
              jurisdiction: update.jurisdiction,
              category: update.category,
              decisionDate: update.decisionDate?.toISOString()
            }
          });

          await db
            .insert(continuousLearningUpdates)
            .values({
              updateType: 'CASE_LAW',
              updateId: update.id,
              processingStatus: 'COMPLETED',
              vectorEmbeddingId: vectorResponse.id,
              contextParameters: {
                jurisdiction: update.jurisdiction,
                court: update.court,
                category: update.category,
                decisionDate: update.decisionDate
              }
            });

        } catch (error) {
          log('Failed to process case law update', 'error', {
            updateId: update.id,
            error
          });
        }
      }

      return updates;
    } catch (error) {
      log('Case law updates processing failed', 'error', error);
      throw error;
    }
  }

  private async updateModelParameters(updates: (RegulatoryUpdate | CaseLawUpdateWithFullText)[]) {
    try {
      const modelUpdates = [];

      const analysisResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You will analyze legal updates and provide model parameter adjustments in JSON format. Response must be valid JSON with a 'modelUpdates' array containing objects with 'model', 'parameters', and 'confidence' fields."
          },
          {
            role: "user",
            content: `Please analyze these legal updates and provide JSON output: ${JSON.stringify({
              updates: updates.map(update => ({
                type: 'jurisdiction' in update ? 'REGULATORY' : 'CASE_LAW',
                content: 'content' in update ? update.content : update.full_text,
                metadata: update.metadata
              }))
            })}`
          }
        ],
        response_format: { type: "json_object" }
      });

      if (!analysisResponse.choices[0].message.content) {
        throw new Error("No content in OpenAI response");
      }

      const analysis = JSON.parse(analysisResponse.choices[0].message.content);

      if (!analysis.modelUpdates || !Array.isArray(analysis.modelUpdates)) {
        throw new Error("Invalid model updates format in response");
      }

      for (const modelUpdate of analysis.modelUpdates) {
        modelUpdates.push({
          model: modelUpdate.model,
          parameters: modelUpdate.parameters,
          confidence: modelUpdate.confidence
        });
      }

      return modelUpdates;
    } catch (error) {
      log('Model parameter update failed', 'error', error);
      throw error;
    }
  }

  async getLatestUpdates() {
    try {
      const recentUpdates = await db
        .select()
        .from(continuousLearningUpdates)
        .orderBy(sql`${continuousLearningUpdates.createdAt} DESC`)
        .limit(10);

      return {
        lastUpdated: recentUpdates[0]?.createdAt || new Date(),
        recentUpdates: recentUpdates,
        modelUpdates: await this.getModelUpdates()
      };
    } catch (error) {
      log('Failed to get latest updates', 'error', error);
      throw error;
    }
  }

  private async getModelUpdates() {
    const updates = await db
      .select()
      .from(continuousLearningUpdates)
      .where(eq(continuousLearningUpdates.processingStatus, 'COMPLETED'))
      .orderBy(sql`${continuousLearningUpdates.createdAt} DESC`)
      .limit(5);

    return updates.map(update => ({
      timestamp: update.createdAt,
      type: update.updateType,
      parameters: update.contextParameters
    }));
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      log('Continuous learning system stopped');
    }
  }
}

export const continuousLearningService = ContinuousLearningService.getInstance();