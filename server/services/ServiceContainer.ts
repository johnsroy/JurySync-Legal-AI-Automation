import { Anthropic } from "@anthropic-ai/sdk";
import { pdfService } from "./pdf-service";
import { complianceAuditService } from "./complianceAuditService";
import { legalResearchService } from "./legalResearchService";
import { documentProcessor } from "./documentProcessor";

export class ServiceContainer {
  private static instance: ServiceContainer;
  private anthropicClient: Anthropic | null = null;
  private services: Map<string, any> = new Map();
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  async initialize() {
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this.initializeServices();
    return this.initializationPromise;
  }

  private async initializeServices() {
    try {
      // Initialize PDF service
      this.services.set("pdf", pdfService);

      // Initialize compliance audit service
      this.services.set("compliance", complianceAuditService);

      // Initialize legal research service
      this.services.set("research", legalResearchService);

      // Initialize document processor
      this.services.set("processor", documentProcessor);

    } catch (error) {
      console.error("Failed to initialize services:", error);
      throw error;
    }
  }

  async getAnthropicClient(): Promise<Anthropic> {
    if (!this.anthropicClient) {
      this.anthropicClient = new Anthropic();
    }
    return this.anthropicClient;
  }

  async ensureServiceAvailable(serviceName: string): Promise<boolean> {
    await this.initialize();
    return this.services.has(serviceName);
  }

  getService(serviceName: string): any {
    return this.services.get(serviceName);
  }
}