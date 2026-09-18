import type { RequestHandler } from 'express';
import { AppError } from '@/utils/errors';

interface Bucket {
  count: number;
  resetAt: number;
}

interface Options {
  windowMs: number;
  max: number;
  keyFor?: (req: Parameters<RequestHandler>[0]) => string;
}

/**
 * Small fixed-window limiter (per IP by default). Good enough for a single
 * process; swap for a shared store when running multiple instances.
 */
export function rateLimit({ windowMs, max, keyFor }: Options): RequestHandler {
  const buckets = new Map<string, Bucket>();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }, windowMs);
  sweep.unref();

  return (req, res, next) => {
    const key = keyFor ? keyFor(req) : (req.ip ?? 'unknown');
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      next(new AppError(429, 'Too many requests, please slow down', 'RATE_LIMITED'));
      return;
    }
    next();
  };
}
