import { prisma } from '../config/prisma.js';
import { processEmailJob } from './emailProcessor.js';
import { EmailJobPayload } from '../types/index.js';
import { ENV } from '../config/env.js';

let isPolling = false;
let pollingInterval: NodeJS.Timeout | null = null;
const activeTimerIds = new Map<string, NodeJS.Timeout>();

export class InMemoryScheduler {
  private static isRunning = false;

  public static start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`⏱️ [In-Memory Scheduler] Started. Polling Postgres every 2000ms for scheduled emails...`);

    // Poll immediately and every 2 seconds
    this.pollDatabase();
    pollingInterval = setInterval(() => {
      this.pollDatabase();
    }, 2000);
  }

  public static stop() {
    this.isRunning = false;
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    for (const timer of activeTimerIds.values()) {
      clearTimeout(timer);
    }
    activeTimerIds.clear();
  }

  public static scheduleJobInMemory(payload: EmailJobPayload, delayMs: number) {
    if (delayMs <= 0) {
      // Execute immediately in background
      setImmediate(() => {
        processEmailJob(payload, async (reQueueDelay) => {
          this.scheduleJobInMemory(payload, reQueueDelay);
        }).catch((err) => {
          console.error(`💥 [In-Memory Execution Error] Job ${payload.jobId}:`, err.message);
        });
      });
      return;
    }

    // Schedule timer
    const timer = setTimeout(() => {
      activeTimerIds.delete(payload.jobId);
      processEmailJob(payload, async (reQueueDelay) => {
        this.scheduleJobInMemory(payload, reQueueDelay);
      }).catch((err) => {
        console.error(`💥 [In-Memory Execution Error] Job ${payload.jobId}:`, err.message);
      });
    }, delayMs);

    activeTimerIds.set(payload.jobId, timer);
  }

  public static cancelJob(jobId: string) {
    const timer = activeTimerIds.get(jobId);
    if (timer) {
      clearTimeout(timer);
      activeTimerIds.delete(jobId);
    }
  }

  private static async pollDatabase() {
    if (isPolling) return;
    isPolling = true;

    try {
      const now = new Date();
      // Find up to concurrency limit of scheduled jobs whose scheduledAt <= now
      const dueJobs = await prisma.emailJob.findMany({
        where: {
          status: { in: ['SCHEDULED', 'RESCHEDULED', 'QUEUED'] },
          scheduledAt: { lte: now },
        },
        take: ENV.WORKER_CONCURRENCY || 5,
        orderBy: { scheduledAt: 'asc' },
      });

      for (const job of dueJobs) {
        const payload: EmailJobPayload = {
          jobId: job.id,
          userId: job.userId,
          batchId: job.batchId || undefined,
          senderEmail: job.senderEmail,
          recipientEmail: job.recipientEmail,
          subject: job.subject,
          body: job.body,
          delayBetweenMs: job.delayBetweenMs,
          hourlyLimit: job.hourlyLimit,
          scheduledAt: job.scheduledAt.toISOString(),
        };

        // Process job
        await processEmailJob(payload, async (reQueueDelay) => {
          this.scheduleJobInMemory(payload, reQueueDelay);
        }).catch((err) => {
          console.error(`💥 [Polling Processor Error] Job ${job.id}:`, err.message);
        });
      }
    } catch (err: any) {
      // Don't crash scheduler on transient DB query error
    } finally {
      isPolling = false;
    }
  }
}
