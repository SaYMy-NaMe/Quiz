import type { Request, Response } from 'express';
import { z } from 'zod';
import * as auth from './auth.service';
import { AUTH_COOKIE } from './auth.middleware';
import { bodyOf } from '@/middleware/validate';
import { isProduction } from '@/config/env';
import type { Instructor } from '@shared';

export const RegisterSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(128),
});

export const LoginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(128),
});

function issue(res: Response, instructor: Instructor, status = 200): void {
  res.cookie(AUTH_COOKIE, auth.signToken(instructor), {
    httpOnly: true,
    // Cross-site clients (client on another domain) need SameSite=None, which requires Secure.
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    maxAge: auth.TOKEN_TTL_SECONDS * 1000,
    path: '/',
  });
  res.status(status).json({ instructor });
}

export async function register(req: Request, res: Response): Promise<void> {
  issue(res, await auth.register(bodyOf(req, RegisterSchema)), 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  issue(res, await auth.login(bodyOf(req, LoginSchema)));
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.status(204).end();
}

export function me(req: Request, res: Response): void {
  res.json({ instructor: req.instructor });
}
