import * as cron from "node-cron";
import { getRAGService } from "./rag-service";
import { getFineractService } from "./fineract-api";

export class BackgroundJobService {
  private static instance: BackgroundJobService | null = null;
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  private constructor() {}

  static getInstance(): BackgroundJobService {
    if (!BackgroundJobService.instance) {
      BackgroundJobService.instance = new BackgroundJobService();
    }
    return BackgroundJobService.instance;
  }

  // Start all background jobs
  startJobs(): void {
    this.startFineractIndexingJob();
    this.startCacheCleanupJob();
    this.startHealthCheckJob();
    console.log("Background jobs started successfully");
  }

  // Stop all background jobs
  stopJobs(): void {
    this.jobs.forEach((job, name) => {
      job.destroy();
      console.log(`Stopped job: ${name}`);
    });
    this.jobs.clear();
    console.log("All background jobs stopped");
  }

  // Index Fineract data every 6 hours
  private startFineractIndexingJob(): void {
    const job = cron.schedule(
      "0 */6 * * *", // Every 6 hours
      async () => {
        console.log("Starting scheduled Fineract data indexing...");
        try {
          const ragService = getRAGService();
          await ragService.indexFineractData();
          console.log(
            "Scheduled Fineract data indexing completed successfully"
          );
        } catch (error) {
          console.error("Error in scheduled Fineract data indexing:", error);
        }
      }
    );

    this.jobs.set("fineract-indexing", job);
    console.log("Fineract indexing job scheduled (every 6 hours)");
  }

  // Clean up expired cache entries every hour
  private startCacheCleanupJob(): void {
    const job = cron.schedule(
      "0 * * * *", // Every hour
      async () => {
        console.log("Starting cache cleanup...");
        try {
          const ragService = getRAGService();
          await ragService.cleanupExpiredCache();
          console.log("Cache cleanup completed successfully");
        } catch (error) {
          console.error("Error in cache cleanup:", error);
        }
      }
    );

    this.jobs.set("cache-cleanup", job);
    console.log("Cache cleanup job scheduled (every hour)");
  }

  // Health check for Fineract connection every 30 minutes
  private startHealthCheckJob(): void {
    const job = cron.schedule(
      "*/30 * * * *", // Every 30 minutes
      async () => {
        try {
          const fineractService = getFineractService();
          const isHealthy = await fineractService.healthCheck();

          if (isHealthy) {
            console.log("Fineract health check: OK");
          } else {
            console.warn(
              "Fineract health check: FAILED - Connection issues detected"
            );
          }
        } catch (error) {
          console.error("Error in Fineract health check:", error);
        }
      }
    );

    this.jobs.set("health-check", job);
    console.log("Health check job scheduled (every 30 minutes)");
  }

  // Manual trigger for immediate indexing
  async triggerImmediateIndexing(): Promise<void> {
    console.log("Triggering immediate Fineract data indexing...");
    try {
      const ragService = getRAGService();
      await ragService.indexFineractData();
      console.log("Immediate Fineract data indexing completed successfully");
    } catch (error) {
      console.error("Error in immediate Fineract data indexing:", error);
      throw error;
    }
  }

  // Get job status
  getJobStatus(): { [key: string]: boolean } {
    const status: { [key: string]: boolean } = {};
    this.jobs.forEach((job, name) => {
      // Check if job exists and is scheduled
      status[name] = this.jobs.has(name);
    });
    return status;
  }

  // Restart a specific job
  restartJob(jobName: string): boolean {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      job.start();
      console.log(`Restarted job: ${jobName}`);
      return true;
    }
    console.warn(`Job not found: ${jobName}`);
    return false;
  }
}

// Initialize and start background jobs when the module is imported
let backgroundJobService: BackgroundJobService | null = null;

export function initializeBackgroundJobs(): void {
  if (!backgroundJobService) {
    backgroundJobService = BackgroundJobService.getInstance();

    // Only start jobs in production or when explicitly enabled
    if (
      process.env.NODE_ENV === "production" ||
      process.env.ENABLE_BACKGROUND_JOBS === "true"
    ) {
      backgroundJobService.startJobs();
    } else {
      console.log(
        "Background jobs disabled in development mode. Set ENABLE_BACKGROUND_JOBS=true to enable."
      );
    }
  }
}

export function getBackgroundJobService(): BackgroundJobService {
  if (!backgroundJobService) {
    backgroundJobService = BackgroundJobService.getInstance();
  }
  return backgroundJobService;
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Received SIGINT, stopping background jobs...");
  if (backgroundJobService) {
    backgroundJobService.stopJobs();
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, stopping background jobs...");
  if (backgroundJobService) {
    backgroundJobService.stopJobs();
  }
  process.exit(0);
});
