import { Router } from 'express';
import * as c from './auth.controller';
import { requireInstructor } from './auth.middleware';
import { validateBody } from '@/middleware/validate';
import { asyncHandler } from '@/middleware/async-handler';
import { rateLimit } from '@/middleware/rate-limit';
import { env } from '@/config/env';

export const authRoutes = Router();
// Credential endpoints are brute-force targets: 20 attempts / 15 min per IP.
const credentialLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: env.NODE_ENV === 'test' ? 1000 : 20 });

authRoutes.post('/register', credentialLimiter, validateBody(c.RegisterSchema), asyncHandler(c.register));
authRoutes.post('/login', credentialLimiter, validateBody(c.LoginSchema), asyncHandler(c.login));
authRoutes.post('/logout', c.logout);
authRoutes.get('/me', requireInstructor, c.me);
