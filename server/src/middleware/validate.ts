import type { Request, RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { badRequest } from '@/utils/errors';

/** Validates `req.body` against a Zod schema and replaces it with the parsed value. */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(badRequest('Validation failed', result.error.flatten()));
      return;
    }
    req.body = result.data as unknown;
    next();
  };
}

/** Typed accessor for a body previously validated by `validateBody(schema)`. */
export const bodyOf = <S extends ZodTypeAny>(req: Request, _schema: S): z.infer<S> => req.body as z.infer<S>;
