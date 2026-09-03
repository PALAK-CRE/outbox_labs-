import { Queue, JobsOptions } from 'bullmq';
import { redisConnectionOptions, isRedisEnabled } from '../config/redis.js';
import { EmailJobPayload, EmailAttachment } from '../types/index.js';
import { prisma } from '../config/prisma.js';
import { SearchService } from '../services/searchService.js';
import { InMemoryScheduler } from './inMemoryScheduler.js';

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue: any = isRedisEnabled
  ? new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
      connection: redisConnectionOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
    })
  : {
      getWaitingCount: async () => 0,
      getActiveCount: async () => 0,
      getDelayedCount: async () => 0,
      getCompletedCount: async () => 0,
      getFailedCount: async () => 0,
      add: async () => ({ id: `mem_${Date.now()}` }),
      getJob: async () => null,
    };

export class EmailSchedulerQueue {
  /**
   * Schedules a single email job at a specific target time using BullMQ delayed jobs or In-Memory Scheduler
   */
  public static async scheduleEmailJob(params: {
    emailJobId: string;
    userId: string;
    batchId?: string;
    senderEmail: string;
    recipientEmail: string;
    subject: string;
    body: string;
    scheduledAt: Date;
    attachments?: EmailAttachment[];
    delayBetweenMs?: number;
    hourlyLimit?: number;
  }): Promise<{ bullJobId: string }> {
    const now = Date.now();
    const targetTime = params.scheduledAt.getTime();
    const delay = Math.max(0, targetTime - now);

    const payload: EmailJobPayload = {
      jobId: params.emailJobId,
      userId: params.userId,
      batchId: params.batchId,
      senderEmail: params.senderEmail,
      recipientEmail: params.recipientEmail,
      subject: params.subject,
      body: params.body,
      attachments: params.attachments,
      delayBetweenMs: params.delayBetweenMs,
      hourlyLimit: params.hourlyLimit,
      scheduledAt: params.scheduledAt.toISOString(),
    };

    let assignedJobId = `job_${params.emailJobId}`;

    if (isRedisEnabled && emailQueue?.add) {
      const jobOptions: JobsOptions = {
        jobId: `email_job_${params.emailJobId}`,
        delay,
      };
      const bullJob = await emailQueue.add('send-email', payload, jobOptions);
      assignedJobId = bullJob.id as string;
    } else {
      InMemoryScheduler.scheduleJobInMemory(payload, delay);
    }

    // Update job with Job ID
    await prisma.emailJob.update({
      where: { id: params.emailJobId },
      data: {
        bullJobId: assignedJobId,
        status: 'SCHEDULED',
      },
    });

    console.log(`⏱️ [Scheduler] Scheduled email ${params.emailJobId} to ${params.recipientEmail} with ${delay}ms delay (at ${params.scheduledAt.toISOString()})`);
    return { bullJobId: assignedJobId };
  }

  /**
   * Schedules a batch of emails (e.g. from CSV upload) with inter-email staggered delay
   */
  public static async scheduleBatchCampaign(params: {
    userId: string;
    name: string;
    senderEmail: string;
    recipients: string[];
    subject: string;
    body: string;
    attachments?: EmailAttachment[];
    startTime: Date;
    delayBetweenMs: number;
    hourlyLimit: number;
  }) {
    // 1. Create EmailBatch in DB
    const batch = await prisma.emailBatch.create({
      data: {
        userId: params.userId,
        name: params.name,
        subject: params.subject,
        body: params.body,
        totalEmails: params.recipients.length,
        scheduledCount: params.recipients.length,
        delayBetweenMs: params.delayBetweenMs,
        hourlyLimit: params.hourlyLimit,
        scheduledStartTime: params.startTime,
        status: 'PROCESSING',
      },
    });

    const jobsCreated = [];
    const baseStartTime = params.startTime.getTime();

    for (let i = 0; i < params.recipients.length; i++) {
      const recipient = params.recipients[i].trim();
      if (!recipient) continue;

      // Stagger each email by delayBetweenMs
      const scheduledTime = new Date(baseStartTime + (i * params.delayBetweenMs));

      const emailJob = await prisma.emailJob.create({
        data: {
          userId: params.userId,
          batchId: batch.id,
          senderEmail: params.senderEmail,
          recipientEmail: recipient,
          subject: params.subject,
          body: params.body,
          status: 'SCHEDULED',
          scheduledAt: scheduledTime,
          delayBetweenMs: params.delayBetweenMs,
          hourlyLimit: params.hourlyLimit,
        },
      });

      // Index in Elasticsearch
      SearchService.indexEmail(emailJob).catch(() => {});

      // Add to queue with attachments
      await this.scheduleEmailJob({
        emailJobId: emailJob.id,
        userId: params.userId,
        batchId: batch.id,
        senderEmail: params.senderEmail,
        recipientEmail: recipient,
        subject: params.subject,
        body: params.body,
        attachments: params.attachments,
        scheduledAt: scheduledTime,
        delayBetweenMs: params.delayBetweenMs,
        hourlyLimit: params.hourlyLimit,
      });

      jobsCreated.push(emailJob);
    }

    return {
      batch,
      totalScheduled: jobsCreated.length,
    };
  }

  /**
   * Cancels a scheduled email job
   */
  public static async cancelJob(jobId: string) {
    const job = await prisma.emailJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Email job not found');

    if (isRedisEnabled && job.bullJobId && emailQueue?.getJob) {
      const bullJob = await emailQueue.getJob(job.bullJobId);
      if (bullJob) {
        await bullJob.remove();
      }
    } else {
      InMemoryScheduler.cancelJob(jobId);
    }

    const updated = await prisma.emailJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' },
    });

    SearchService.indexEmail(updated).catch(() => {});
    return updated;
  }

  /**
   * Reschedules a job to a new time
   */
  public static async rescheduleJob(jobId: string, newScheduledAt: Date) {
    const job = await prisma.emailJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Email job not found');

    // Remove existing bull job or timer if any
    if (isRedisEnabled && job.bullJobId && emailQueue?.getJob) {
      const bullJob = await emailQueue.getJob(job.bullJobId);
      if (bullJob) {
        await bullJob.remove();
      }
    } else {
      InMemoryScheduler.cancelJob(jobId);
    }

    // Add new scheduled job
    const { bullJobId } = await this.scheduleEmailJob({
      emailJobId: job.id,
      userId: job.userId,
      batchId: job.batchId || undefined,
      senderEmail: job.senderEmail,
      recipientEmail: job.recipientEmail,
      subject: job.subject,
      body: job.body,
      scheduledAt: newScheduledAt,
      delayBetweenMs: job.delayBetweenMs,
      hourlyLimit: job.hourlyLimit,
    });

    const updated = await prisma.emailJob.update({
      where: { id: jobId },
      data: {
        scheduledAt: newScheduledAt,
        status: 'SCHEDULED',
        bullJobId,
      },
    });

    SearchService.indexEmail(updated).catch(() => {});
    return updated;
  }
}
