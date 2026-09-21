import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { AppError } from '@/utils/errors';
import { logger } from '@/services/logger';
import { env } from '@/config/env';

const isDuplicateKey = (err: unknown): err is { code: number; keyValue?: Record<string, unknown> } =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;

/**
 * Single place where errors become HTTP responses. Every failure is logged with the route so
 * an auth problem is visible in the server terminal, not just as a generic client message.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const route = `${req.method} ${req.originalUrl}`;

  if (err instanceof AppError) {
    if (env.NODE_ENV !== 'test') logger.warn({ route, status: err.status, code: err.code, details: err.details }, err.message);
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // Unique-index race (e.g. two registrations with the same email at once).
  if (isDuplicateKey(err)) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'value';
    logger.warn({ route, field }, 'Duplicate key');
    res.status(409).json({ error: { code: 'CONFLICT', message: `An account with this ${field} already exists` } });
    return;
  }
  if (err instanceof mongoose.Error.ValidationError) {
    logger.warn({ route, err }, 'Mongoose validation failed');
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    return;
  }
  if (typeof err === 'object' && err !== null && 'type' in err && (err as { type: string }).type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' } });
    return;
  }
  if (typeof err === 'object' && err !== null && 'type' in err && (err as { type: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed JSON body' } });
    return;
  }
  logger.error({ route, err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: env.NODE_ENV === 'production' ? 'Internal server error' : (err instanceof Error ? err.message : 'Internal server error') } });
};
