import { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from './auth.service';
import { SESSION_COOKIE, requireInstructor } from './auth.middleware';
import { validateBody } from '@/middleware/validate';
import { env } from '@/config/env';

const RegisterSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(128),
});

const LoginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(128),
});

export function createAuthRouter(auth: AuthService): Router {
  const router = Router();

  const setCookie = (res: import('express').Response, sessionId: string, expiresAt: string) => {
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      expires: new Date(expiresAt),
      path: '/',
    });
  };

  router.post('/register', validateBody(RegisterSchema), (req, res) => {
    const { instructor, sessionId, expiresAt } = auth.register(req.body);
    setCookie(res, sessionId, expiresAt);
    res.status(201).json({ instructor });
  });

  router.post('/login', validateBody(LoginSchema), (req, res) => {
    const { instructor, sessionId, expiresAt } = auth.login(req.body);
    setCookie(res, sessionId, expiresAt);
    res.json({ instructor });
  });

  router.post('/logout', (req, res) => {
    if (req.sessionId) auth.logout(req.sessionId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  });

  router.get('/me', requireInstructor, (req, res) => {
    res.json({ instructor: req.instructor });
  });

  return router;
}
