import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../lib/redis';

type Bucket = { count: number; resetAt: number };
const MAX_BUCKETS = 5_000;

/**
 * Distributed rate limiter backed by Redis with an in-memory fallback.
 * When Redis is available, limits are enforced across all backend instances.
 */
export function rateLimit(windowMs: number, max: number) {
  const buckets = new Map<string, Bucket>();

  return async (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;

    // Try Redis first for distributed rate limiting
    try {
      const redis = await getRedisClient();
      if (redis) {
        const redisKey = `cine3d:rl:${key}`;
        const count = await redis.incr(redisKey);
        if (count === 1) {
          await redis.pExpire(redisKey, windowMs);
        }
        const ttl = await redis.pTTL(redisKey);
        const resetAt = now + Math.max(ttl, 0);

        res.setHeader('RateLimit-Limit', max);
        res.setHeader('RateLimit-Remaining', Math.max(0, max - count));
        res.setHeader('RateLimit-Reset', Math.ceil(resetAt / 1000));

        if (count > max) {
          res.setHeader('Retry-After', Math.max(1, Math.ceil(Math.max(ttl, 0) / 1000)));
          return res.status(429).json({ message: 'Too many requests. Please try again later.' });
        }
        return next();
      }
    } catch {
      // Redis unavailable — fall through to in-memory
    }

    // In-memory fallback (single-instance only)
    if (!buckets.has(key) && buckets.size >= MAX_BUCKETS) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
      if (buckets.size >= MAX_BUCKETS) {
        const oldestKey = buckets.keys().next().value as string | undefined;
        if (oldestKey) buckets.delete(oldestKey);
      }
    }
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

    bucket.count += 1;
    buckets.set(key, bucket);
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', Math.max(0, max - bucket.count));
    res.setHeader('RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    return next();
  };
}
