import type { RequestHandler } from 'express';
import type { Instructor } from '@shared';
import { verifyToken } from './auth.service';
import { unauthorized } from '@/utils/errors';

export const AUTH_COOKIE = 'quiz_token';

declare global {
  namespace Express {
    interface Request {
      instructor?: Instructor;
    }
  }
}

/** Attaches `req.instructor` when a valid JWT cookie (or Bearer token) is present; never rejects. */
export const attachInstructor: RequestHandler = (req, _res, next) => {
  const cookies = req.cookies as Record<string, string | undefined>;
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
  const token = cookies[AUTH_COOKIE] ?? bearer;
  if (token) {
    const instructor = verifyToken(token);
    if (instructor) req.instructor = instructor;
  }
  next();
};

/** RBAC guard: only authenticated instructors pass. */
export const requireInstructor: RequestHandler = (req, _res, next) => {
  if (!req.instructor) {
    next(unauthorized('Authentication required'));
    return;
  }
  next();
};
