import Redis, { RedisOptions } from 'ioredis';
import { ENV } from './env.js';

const getRedisConnectionOptions = (): RedisOptions => {
  if (ENV.REDIS_URL) {
    const isTls = ENV.REDIS_URL.startsWith('rediss://');
    try {
      const parsedUrl = new URL(ENV.REDIS_URL);
      return {
        host: parsedUrl.hostname,
        port: parseInt(parsedUrl.port || '6379', 10),
        username: parsedUrl.username ? decodeURIComponent(parsedUrl.username) : undefined,
        password: parsedUrl.password ? decodeURIComponent(parsedUrl.password) : undefined,
        tls: isTls ? { rejectUnauthorized: false } : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };
    } catch {
      return {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };
    }
  }

  return {
    host: ENV.REDIS_HOST,
    port: ENV.REDIS_PORT,
    password: ENV.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
  };
};

export const redisConnectionOptions: RedisOptions = getRedisConnectionOptions();

export const redisClient = ENV.REDIS_URL
  ? new Redis(ENV.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: ENV.REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    })
  : new Redis(redisConnectionOptions);

redisClient.on('connect', () => {
  console.log(`✅ Redis connected successfully`);
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Connection Error:', err.message);
});

