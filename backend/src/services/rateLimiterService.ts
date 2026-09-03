import { redisClient } from '../config/redis.js';
import { ENV } from '../config/env.js';
import { sendSlackRateLimitAlert } from './slackService.js';
import { prisma } from '../config/prisma.js';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  windowKey: string;
  delayUntilNextWindowMs: number;
  nextWindowStartTime: Date;
}

export class RateLimiterService {
  /**
   * Generates a deterministic hourly window key based on UTC hour or timestamp.
   */
  public static getHourlyWindowKey(senderEmail: string, date: Date = new Date()): { windowKey: string; windowExpiryMs: number; nextWindowDate: Date } {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');

    const windowKey = `ratelimit:${senderEmail.toLowerCase()}:${year}${month}${day}${hour}`;

    // Next hour start timestamp in UTC
    const nextWindowDate = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours() + 1,
      0,
      0,
      0
    ));

    const delayUntilNextWindowMs = Math.max(1000, nextWindowDate.getTime() - date.getTime());

    return {
      windowKey,
      windowExpiryMs: delayUntilNextWindowMs,
      nextWindowDate,
    };
  }

  /**
   * Atomically checks and increments the sender's hourly counter in Redis.
   * If limit is reached, does not increment and returns allowed: false with rescheduling timestamp.
   */
  public static async checkAndConsumeRateLimit(
    senderEmail: string,
    configuredLimit?: number,
    userId?: string
  ): Promise<RateLimitCheckResult> {
    const limit = configuredLimit && configuredLimit > 0 ? configuredLimit : ENV.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const now = new Date();
    const { windowKey, windowExpiryMs, nextWindowDate } = this.getHourlyWindowKey(senderEmail, now);

    // Redis Lua script to atomically check and increment only if below limit
    const luaScript = `
      local current = redis.call('GET', KEYS[1])
      if current == false then
        redis.call('SET', KEYS[1], 1, 'PX', ARGV[1])
        return 1
      end
      local count = tonumber(current)
      local maxLimit = tonumber(ARGV[2])
      if count < maxLimit then
        return redis.call('INCR', KEYS[1])
      else
        return -1
      end
    `;

    try {
      // 2 hours TTL safety margin (7200 seconds)
      const ttlMs = Math.max(windowExpiryMs + 3600000, 7200000);
      const result = await redisClient.eval(luaScript, 1, windowKey, ttlMs.toString(), limit.toString()) as number;

      if (result === -1) {
        // Limit exceeded
        const currentCount = parseInt((await redisClient.get(windowKey)) || `${limit}`, 10);
        
        // Log in DB and alert Slack (with debounce flag in Redis to avoid spamming multiple alerts in same hour)
        await this.handleRateLimitExceeded({
          userId,
          senderEmail,
          currentCount,
          limit,
          windowKey,
          nextWindowDate,
        });

        return {
          allowed: false,
          currentCount,
          limit,
          windowKey,
          delayUntilNextWindowMs: windowExpiryMs,
          nextWindowStartTime: nextWindowDate,
        };
      }

      return {
        allowed: true,
        currentCount: result,
        limit,
        windowKey,
        delayUntilNextWindowMs: 0,
        nextWindowStartTime: now,
      };
    } catch (err: any) {
      console.error('⚠️ Redis rate limiter error, allowing with caution:', err.message);
      return {
        allowed: true,
        currentCount: 1,
        limit,
        windowKey,
        delayUntilNextWindowMs: 0,
        nextWindowStartTime: now,
      };
    }
  }

  /**
   * Dispatches Slack alert and records rate limit incident
   */
  private static async handleRateLimitExceeded(params: {
    userId?: string;
    senderEmail: string;
    currentCount: number;
    limit: number;
    windowKey: string;
    nextWindowDate: Date;
  }) {
    const alertDebounceKey = `alert_sent:${params.windowKey}`;
    const alreadyAlerted = await redisClient.get(alertDebounceKey);

    if (!alreadyAlerted) {
      // Set 1-hour debounce
      await redisClient.set(alertDebounceKey, '1', 'EX', 3600);

      // Record in DB
      try {
        await prisma.rateLimitLog.create({
          data: {
            senderEmail: params.senderEmail,
            windowKey: params.windowKey,
            count: params.currentCount,
            limit: params.limit,
            triggeredSlack: true,
          },
        });
      } catch (dbErr) {
        // Ignore DB logging errors
      }

      // Send live Slack alert
      await sendSlackRateLimitAlert({
        userId: params.userId,
        senderEmail: params.senderEmail,
        currentCount: params.currentCount,
        hourlyLimit: params.limit,
        windowKey: params.windowKey,
        rescheduledUntil: params.nextWindowDate.toISOString(),
      });
    }
  }

  /**
   * Get current usage statistics for a sender in the current hour window
   */
  public static async getSenderHourlyUsage(senderEmail: string): Promise<{ count: number; limit: number; remaining: number; resetInMs: number }> {
    const { windowKey, windowExpiryMs } = this.getHourlyWindowKey(senderEmail);
    const countStr = await redisClient.get(windowKey);
    const count = countStr ? parseInt(countStr, 10) : 0;
    const limit = ENV.MAX_EMAILS_PER_HOUR_PER_SENDER;

    return {
      count,
      limit,
      remaining: Math.max(0, limit - count),
      resetInMs: windowExpiryMs,
    };
  }
}
