import cors, { type CorsOptions } from 'cors';
import type { RequestHandler } from 'express';

/**
 * CORS allow-list from CLIENT_ORIGIN (+ optional CLIENT_ORIGINS). Exact origins match
 * verbatim; a `*.` prefix matches one subdomain label (preview deployments). Requests without
 * an Origin header (curl, same-origin) pass; unknown origins get no CORS headers.
 */
export function createCorsMiddleware(allowed: string[]): RequestHandler {
  const normalized = allowed.map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
  const exact = new Set(normalized.filter((o) => !o.includes('*')));
  const wildcards = normalized.filter((o) => o.includes('*')).map((o) => new RegExp(`^${o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+')}$`));
  const options: CorsOptions = {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 600,
    origin: (origin, cb) => cb(null, !origin || exact.has(origin) || wildcards.some((re) => re.test(origin)) ? (origin ?? true) : false),
  };
  return cors(options);
}
