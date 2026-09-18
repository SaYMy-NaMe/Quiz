import cors, { type CorsOptions } from 'cors';
import type { RequestHandler } from 'express';
import { logger } from '@/services/logger';

/**
 * Dynamic CORS: the allow-list comes from environment variables so the same build can serve a
 * local Vite dev server, a preview deployment and production without code changes.
 *
 *   CLIENT_ORIGIN=http://localhost:5173
 *   CLIENT_ORIGINS=http://localhost:5173,https://your-app.vercel.app,https://*.vercel.app
 *
 * Rules:
 *  - exact origins match verbatim;
 *  - a leading `*.` matches any subdomain (preview deployments);
 *  - requests with no Origin header (curl, same-origin, server-to-server) are allowed;
 *  - anything else is rejected without CORS headers (the browser blocks the response).
 * Credentials are enabled because the instructor session is an httpOnly cookie.
 */
export function createCorsMiddleware(allowed: string[]): RequestHandler {
  const normalized = allowed.map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
  const exact = new Set(normalized.filter((o) => !o.includes('*')));
  const wildcards = normalized
    .filter((o) => o.includes('*'))
    .map((o) => new RegExp(`^${o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+')}$`));

  const isAllowed = (origin: string): boolean => exact.has(origin) || wildcards.some((re) => re.test(origin));

  const options: CorsOptions = {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
    maxAge: 600,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (isAllowed(origin)) {
        callback(null, origin);
        return;
      }
      logger.warn({ origin }, 'CORS: origin not in allow-list');
      callback(null, false);
    },
  };
  return cors(options);
}
