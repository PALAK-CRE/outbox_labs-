import { EmailJobPayload } from '../types/index.js';
import { RateLimiterService } from '../services/rateLimiterService.js';
import { sendEmailViaEthereal } from '../services/smtpService.js';
import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';
import { SearchService } from '../services/searchService.js';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processEmailJob(payload: EmailJobPayload, reQueueCallback?: (delayMs: number) => Promise<void>) {
  const { jobId, userId, batchId, senderEmail, recipientEmail, subject, body, delayBetweenMs, hourlyLimit } = payload;

  console.log(`🚀 [Processor] Processing Email ID ${jobId} -> ${recipientEmail}`);

  // 1. Check idempotency in DB
  const dbJob = await prisma.emailJob.findUnique({
    where: { id: jobId },
  });

  if (!dbJob) {
    console.warn(`⚠️ [Processor] Email job ${jobId} not found in DB. Skipping.`);
    return { status: 'skipped_not_found' };
  }

  if (dbJob.status === 'SENT') {
    console.log(`ℹ️ [Processor] Email job ${jobId} already sent. Skipping.`);
    return { status: 'already_sent' };
  }

  if (dbJob.status === 'CANCELLED') {
    console.log(`ℹ️ [Processor] Email job ${jobId} was cancelled. Skipping.`);
    return { status: 'cancelled' };
  }

  // 2. Enforce Hourly Rate Limiting
  const rateLimitResult = await RateLimiterService.checkAndConsumeRateLimit(
    senderEmail,
    hourlyLimit || ENV.MAX_EMAILS_PER_HOUR_PER_SENDER,
    userId
  );

  if (!rateLimitResult.allowed) {
    console.log(`⏳ [Rate-Limit] Sender '${senderEmail}' reached limit (${rateLimitResult.currentCount}/${rateLimitResult.limit}). Rescheduling job ${jobId} by ${rateLimitResult.delayUntilNextWindowMs}ms into next window (${rateLimitResult.nextWindowStartTime.toISOString()}).`);

    if (reQueueCallback) {
      await reQueueCallback(rateLimitResult.delayUntilNextWindowMs);
    }

    // Update DB status to RESCHEDULED
    const updated = await prisma.emailJob.update({
      where: { id: jobId },
      data: {
        status: 'RESCHEDULED',
        scheduledAt: rateLimitResult.nextWindowStartTime,
        lastWindowKey: rateLimitResult.windowKey,
        errorMessage: `Hourly rate limit exceeded (${rateLimitResult.limit}/hr). Rescheduled into next window.`,
      },
    });

    SearchService.indexEmail(updated).catch(() => {});

    return {
      status: 'rescheduled',
      rescheduledAt: rateLimitResult.nextWindowStartTime,
      windowKey: rateLimitResult.windowKey,
    };
  }

  // 3. Mark job as SENDING
  await prisma.emailJob.update({
    where: { id: jobId },
    data: {
      status: 'SENDING',
      attempts: { increment: 1 },
    },
  });

  // 4. Enforce minimum inter-email delay throttling
  const minDelay = Math.max(ENV.MIN_EMAIL_DELAY_MS, delayBetweenMs || 0);
  if (minDelay > 0) {
    await sleep(minDelay);
  }

  // 5. Send Email via Ethereal / Real SMTP Relay
  try {
    const sendResult = await sendEmailViaEthereal({
      from: senderEmail,
      to: recipientEmail,
      subject,
      html: body,
      attachments: payload.attachments,
    });

    const etherealUrl = sendResult.previewUrl || undefined;

    // 6. Update DB status to SENT
    const completedJob = await prisma.emailJob.update({
      where: { id: jobId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        etherealMessageUrl: etherealUrl,
        errorMessage: null,
      },
    });

    // 7. Update Batch status if part of a batch
    if (batchId) {
      await prisma.emailBatch.update({
        where: { id: batchId },
        data: {
          sentCount: { increment: 1 },
        },
      });
    }

    // 8. Sync with Elasticsearch
    SearchService.indexEmail(completedJob).catch(() => {});

    console.log(`✅ [Processor Success] Email ${jobId} successfully sent to ${recipientEmail}! Preview URL: ${etherealUrl || 'N/A'}`);

    return {
      status: 'sent',
      messageId: sendResult.messageId,
      previewUrl: etherealUrl,
    };
  } catch (sendError: any) {
    console.error(`❌ [Processor Error] Failed sending email ${jobId} to ${recipientEmail}:`, sendError.message);

    const failedJob = await prisma.emailJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorMessage: sendError.message,
      },
    });

    if (batchId) {
      await prisma.emailBatch.update({
        where: { id: batchId },
        data: {
          failedCount: { increment: 1 },
        },
      });
    }

    SearchService.indexEmail(failedJob).catch(() => {});
    throw sendError;
  }
}
