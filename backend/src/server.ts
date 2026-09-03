import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { ENV } from './config/env.js';
import { connectDatabase } from './config/prisma.js';
import { initElasticsearch } from './config/elasticsearch.js';
import { emailQueue } from './queue/emailQueue.js';
import { startEmailWorker } from './queue/emailWorker.js';

import authRoutes from './routes/authRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import slackRoutes from './routes/slackRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

// Middlewares
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow non-browser requests or same-origin
    if (!origin) return callback(null, true);
    if (
      origin === ENV.FRONTEND_URL ||
      origin === 'http://localhost:5173' ||
      origin === 'http://localhost:3000' ||
      origin.endsWith('.vercel.app') ||
      origin.includes('vercel.app')
    ) {
      return callback(null, true);
    }
    // Allow any other configured frontends
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import { isRedisEnabled } from './config/redis.js';
import { InMemoryScheduler } from './queue/inMemoryScheduler.js';

// BullMQ Live Dashboard setup with @bull-board (if Redis enabled)
if (isRedisEnabled) {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter: serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());
} else {
  app.get('/admin/queues', (req: express.Request, res: express.Response) => {
    res.json({
      status: 'active',
      mode: 'In-Memory / Database Scheduler',
      description: 'Emails are scheduled and processed reliably directly via PostgreSQL and Node timer scheduler.',
      redisEnabled: false,
    });
  });
}

// Health Check
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    service: 'ReachInbox Email Scheduler',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redisEnabled: isRedisEnabled,
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/stats', statsRoutes);

// Error Handler
app.use(errorHandler);

// Bootstrap Server & Worker
async function bootstrap() {
  console.log('🚀 Starting ReachInbox Email Job Scheduler Server...');

  // 1. Connect Postgres
  await connectDatabase();

  // 2. Initialize Elasticsearch index
  await initElasticsearch();

  // 3. Start BullMQ Worker or InMemory Scheduler
  if (isRedisEnabled) {
    startEmailWorker();
  } else {
    InMemoryScheduler.start();
  }

  // 4. Start HTTP Server
  const server = app.listen(ENV.PORT, () => {
    console.log(`🌐 Server running on http://localhost:${ENV.PORT}`);
    console.log(`📊 Mode: ${isRedisEnabled ? 'BullMQ + Redis' : 'In-Memory + Database Scheduler'}`);
    console.log(`🔗 API Base: http://localhost:${ENV.PORT}/api`);
  });

  return server;
}

bootstrap().catch((err) => {
  console.error('💥 Fatal Startup Error:', err);
  process.exit(1);
});

export default app;
