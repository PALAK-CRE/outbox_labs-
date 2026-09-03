import { Request, Response } from 'express';
import { emailQueue } from '../queue/emailQueue.js';
import { prisma } from '../config/prisma.js';
import { RateLimiterService } from '../services/rateLimiterService.js';
import { ENV } from '../config/env.js';
import { isESAvailable } from '../config/elasticsearch.js';

export class StatsController {
  public static async getDashboardStats(req: Request, res: Response) {
    try {
      const [
        waitingCount,
        activeCount,
        delayedCount,
        completedCount,
        failedCount,
        totalJobsInDb,
        totalSentInDb,
        totalScheduledInDb,
        totalFailedInDb,
      ] = await Promise.all([
        emailQueue.getWaitingCount().catch(() => 0),
        emailQueue.getActiveCount().catch(() => 0),
        emailQueue.getDelayedCount().catch(() => 0),
        emailQueue.getCompletedCount().catch(() => 0),
        emailQueue.getFailedCount().catch(() => 0),
        prisma.emailJob.count().catch(() => 0),
        prisma.emailJob.count({ where: { status: 'SENT' } }).catch(() => 0),
        prisma.emailJob.count({ where: { status: { in: ['SCHEDULED', 'QUEUED', 'SENDING', 'RESCHEDULED'] } } }).catch(() => 0),
        prisma.emailJob.count({ where: { status: 'FAILED' } }).catch(() => 0),
      ]);

      // Fetch sample rate-limit usage for common senders
      const sampleSender = req.query.sender as string || 'sales@reachinbox.ai';
      const rateLimitUsage = await RateLimiterService.getSenderHourlyUsage(sampleSender);

      return res.json({
        success: true,
        queue: {
          waiting: waitingCount,
          active: activeCount,
          delayed: delayedCount,
          completed: completedCount,
          failed: failedCount,
          total: waitingCount + activeCount + delayedCount + completedCount + failedCount,
        },
        database: {
          total: totalJobsInDb,
          sent: totalSentInDb,
          scheduled: totalScheduledInDb,
          failed: totalFailedInDb,
        },
        system: {
          concurrency: ENV.WORKER_CONCURRENCY,
          minDelayMs: ENV.MIN_EMAIL_DELAY_MS,
          maxEmailsPerHour: ENV.MAX_EMAILS_PER_HOUR,
          elasticsearchOnline: isESAvailable(),
          redisConnected: true,
        },
        rateLimit: {
          sender: sampleSender,
          usedThisHour: rateLimitUsage.count,
          limit: rateLimitUsage.limit,
          remainingThisHour: rateLimitUsage.remaining,
          resetInMs: rateLimitUsage.resetInMs,
          percentUsed: Math.round((rateLimitUsage.count / rateLimitUsage.limit) * 100),
        },
      });
    } catch (error: any) {
      console.error('❌ Stats error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}
