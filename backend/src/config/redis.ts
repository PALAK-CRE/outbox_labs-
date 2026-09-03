import Redis, { RedisOptions } from 'ioredis';
import { ENV } from './env.js';
import EventEmitter from 'events';

const getRedisConnectionOptions = (): RedisOptions => {
  const rawUrl = (ENV.REDIS_URL || '').replace(/^["']|["']$/g, '').trim();

  if (rawUrl) {
    const isTls = rawUrl.startsWith('rediss://');
    try {
      const parsedUrl = new URL(rawUrl);
      return {
        host: parsedUrl.hostname,
        port: parseInt(parsedUrl.port || (isTls ? '6380' : '6379'), 10),
        username: parsedUrl.username ? decodeURIComponent(parsedUrl.username) : undefined,
        password: parsedUrl.password ? decodeURIComponent(parsedUrl.password) : undefined,
        tls: isTls ? { rejectUnauthorized: false } : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times: number) => Math.min(times * 1000, 15000),
      };
    } catch (err: any) {
      console.warn(`⚠️ [Redis] Failed to parse REDIS_URL (${rawUrl}): ${err.message}.`);
    }
  }

  return {
    host: ENV.REDIS_HOST,
    port: ENV.REDIS_PORT,
    password: ENV.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times: number) => Math.min(times * 1000, 15000),
  };
};

export const redisConnectionOptions: RedisOptions = getRedisConnectionOptions();

// In-memory dummy redis client if Redis is disabled
class DummyRedisClient extends EventEmitter {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, val: string, ..._args: any[]): Promise<'OK'> {
    this.store.set(key, val);
    return 'OK';
  }

  async eval(_script: string, _numKeys: number, key: string, _ttl: string, maxLimit: string): Promise<number> {
    const current = parseInt(this.store.get(key) || '0', 10);
    const limit = parseInt(maxLimit, 10);
    if (current < limit) {
      const next = current + 1;
      this.store.set(key, next.toString());
      return next;
    }
    return -1;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }
}

export const isRedisEnabled = Boolean(ENV.ENABLE_REDIS && (ENV.REDIS_URL || (ENV.REDIS_HOST && ENV.REDIS_HOST !== 'localhost')));

export const redisClient: any = isRedisEnabled
  ? new Redis(redisConnectionOptions)
  : new DummyRedisClient();

if (isRedisEnabled) {
  redisClient.on('connect', () => {
    console.log(`✅ [Redis] Connected successfully to ${redisConnectionOptions.host}:${redisConnectionOptions.port}`);
  });

  let lastLoggedErrorTime = 0;
  redisClient.on('error', (err: any) => {
    const now = Date.now();
    if (now - lastLoggedErrorTime > 5000) {
      console.error(`❌ Redis Connection Error (${redisConnectionOptions.host}:${redisConnectionOptions.port}): ${err.message}`);
      lastLoggedErrorTime = now;
    }
  });
} else {
  console.log(`ℹ️ [Redis] Running in In-Memory / Database Scheduler mode (No external Redis required).`);
}

