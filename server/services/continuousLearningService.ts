import { openai } from './openai';
import { db } from '../db';
import { 
  regulatoryUpdates, 
  caseLawUpdates, 
  continuousLearningUpdates,
  type RegulatoryUpdate,
  type CaseLawUpdate
} from '@shared/schema';
import { eq, and, lte } from 'drizzle-orm';
import { chromaStore } from './chromaStore';

function log(message: string, type: 'info' | 'error' | 'debug' = 'info', context?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ContinuousLearning] [${type.toUpperCase()}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
}

export class ContinuousLearningService {
  private static instance: ContinuousLearningService;
  private updateInterval: NodeJS.Timer | null = null;
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
  }

  private async performUpdate() {
    try {
      log('Starting periodic update');

      // Process regulatory updates
      const regulatoryResults = await this.processRegulatoryUpdates();
      
      // Process case law updates
      const caseLawResults = await this.processCaseLawUpdates();

      // Update model context parameters
      const modelUpdates = await this.updateModelParameters([...regulatoryResults, ...caseLawResults]);

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
      // Get unprocessed regulatory updates
      const updates = await db
        .select()
        .from(regulatoryUpdates)
        .where(
          and(
            eq(regulatoryUpdates.processed, false),
            lte(regulatoryUpdates.effectiveDate, new Date())
          )
        );

      for (const update of updates) {
        try {
          // Generate vector embedding
          const embedding = await chromaStore.addDocument(
            update.content,
            {
              type: 'regulatory',
              id: update.id.toString(),
              metadata: update.metadata
            }
          );

          // Create continuous learning update record
          await db
            .insert(continuousLearningUpdates)
            .values({
              updateType: 'REGULATORY',
              updateId: update.id,
              processingStatus: 'COMPLETED',
              vectorEmbeddingId: embedding.id,
              contextParameters: {
                jurisdiction: update.jurisdiction,
                effectiveDate: update.effectiveDate,
                type: update.type
              },
              processedAt: new Date()
            });

          // Mark update as processed
          await db
            .update(regulatoryUpdates)
            .set({ processed: true })
            .where(eq(regulatoryUpdates.id, update.id));

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

  private async processCaseLawUpdates(): Promise<CaseLawUpdate[]> {
    try {
      // Get unprocessed case law updates
      const updates = await db
        .select()
        .from(caseLawUpdates)
        .where(
          and(
            eq(caseLawUpdates.processed, false),
            lte(caseLawUpdates.decisionDate, new Date())
          )
        );

      for (const update of updates) {
        try {
          // Generate vector embedding
          const embedding = await chromaStore.addDocument(
            update.fullText,
            {
              type: 'case_law',
              id: update.id.toString(),
              metadata: update.metadata
            }
          );

          // Create continuous learning update record
          await db
            .insert(continuousLearningUpdates)
            .values({
              updateType: 'CASE_LAW',
              updateId: update.id,
              processingStatus: 'COMPLETED',
              vectorEmbeddingId: embedding.id,
              contextParameters: {
                jurisdiction: update.jurisdiction,
                court: update.court,
                category: update.category,
                decisionDate: update.decisionDate
              },
              processedAt: new Date()
            });

          // Mark update as processed
          await db
            .update(caseLawUpdates)
            .set({ processed: true })
            .where(eq(caseLawUpdates.id, update.id));

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

  private async updateModelParameters(updates: (RegulatoryUpdate | CaseLawUpdate)[]) {
    try {
      const modelUpdates = [];

      // Analyze updates and generate model parameter adjustments
      const analysisResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Analyze recent legal updates and suggest model parameter adjustments to improve performance."
          },
          {
            role: "user",
            content: JSON.stringify({
              updates: updates.map(update => ({
                type: 'jurisdiction' in update ? 'REGULATORY' : 'CASE_LAW',
                content: update.content || update.fullText,
                metadata: update.metadata
              }))
            })
          }
        ],
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(analysisResponse.choices[0].message.content);

      // Apply model parameter updates
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

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      log('Continuous learning system stopped');
    }
  }
}

export const continuousLearningService = ContinuousLearningService.getInstance();
