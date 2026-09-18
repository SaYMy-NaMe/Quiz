import type { RequestHandler } from 'express';
import type { Instructor } from '@shared';
import type { AuthService } from './auth.service';
import { unauthorized } from '@/utils/errors';

export const SESSION_COOKIE = 'quiz_session';

declare global {
  namespace Express {
    interface Request {
      instructor?: Instructor;
      sessionId?: string;
    }
  }
}

/** Attaches `req.instructor` when a valid session cookie is present (never rejects). */
export function attachSession(auth: AuthService): RequestHandler {
  return (req, _res, next) => {
    const cookies = req.cookies as Record<string, string | undefined>;
    const sessionId = cookies[SESSION_COOKIE];
    if (!sessionId) {
      next();
      return;
    }
    auth
      .resolveSession(sessionId)
      .then((instructor) => {
        if (instructor) {
          req.instructor = instructor;
          req.sessionId = sessionId;
        }
        next();
      })
      .catch(next);
  };
}

/** RBAC guard: only authenticated instructors pass. */
export const requireInstructor: RequestHandler = (req, _res, next) => {
  if (!req.instructor) {
    next(unauthorized('Authentication required'));
    return;
  }
  next();
};
