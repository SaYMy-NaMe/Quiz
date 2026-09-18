import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { badRequest } from '@/utils/errors';

/** Validates `req.body` against a Zod schema and replaces it with the parsed value. */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(badRequest('Validation failed', result.error.flatten()));
      return;
    }
    req.body = result.data;
    next();
  };
}
