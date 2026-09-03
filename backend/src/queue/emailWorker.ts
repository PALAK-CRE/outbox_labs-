import { Worker, Job } from 'bullmq';
import { redisConnectionOptions, isRedisEnabled } from '../config/redis.js';
import { EMAIL_QUEUE_NAME, emailQueue } from './emailQueue.js';
import { EmailJobPayload } from '../types/index.js';
import { ENV } from '../config/env.js';
import { processEmailJob } from './emailProcessor.js';

export function startEmailWorker() {
  if (!isRedisEnabled) {
    console.log('ℹ️ [Worker] Redis is disabled; running In-Memory scheduler instead of BullMQ Worker.');
    return null;
  }

  const worker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobPayload>) => {
      return processEmailJob(job.data, async (reQueueDelay) => {
        await emailQueue.add('send-email', job.data, {
          delay: reQueueDelay,
          jobId: `email_job_${job.data.jobId}_rescheduled_${Date.now()}`,
        });
      });
    },
    {
      connection: redisConnectionOptions,
      concurrency: ENV.WORKER_CONCURRENCY,
      limiter: {
        max: 10,
        duration: 1000,
      },
    }
  );

  worker.on('ready', () => {
    console.log(`👷 [Worker] Email Worker active with concurrency = ${ENV.WORKER_CONCURRENCY}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`💥 [Worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
