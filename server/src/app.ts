import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from '@/config/env';
import { logger } from '@/services/logger';
import { errorHandler } from '@/middleware/error-handler';
import type { Container } from '@/container';
import { attachSession, createAuthRouter } from '@/modules/auth';
import { createQuizRouter, createUploadRouter, createAttemptRouter } from '@/modules/quiz';
import { createShareRouter, createInviteRouter } from '@/modules/share';
import { createProctorRouter } from '@/modules/proctor';
import { createInstructorLeaderboardRouter } from '@/modules/leaderboard';
import { createReportingRouter } from '@/modules/reporting';
import { createDashboardRouter } from '@/modules/dashboard';
import path from 'node:path';
import fs from 'node:fs';
import { rateLimit } from '@/middleware/rate-limit';

export interface AppOptions {
  /** Built client directory to serve with an SPA fallback; defaults to env.CLIENT_DIST. */
  clientDist?: string | undefined;
}

export function createApp(container: Container, { clientDist = env.CLIENT_DIST }: AppOptions = {}): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Only meaningful behind TLS. On plain http (LAN, staging) it makes every browser that
          // opens a share link on another device upgrade asset URLs to https and fail to load.
          ...(env.HTTPS ? {} : { 'upgrade-insecure-requests': null }),
        },
      },
    }),
  );
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  // Examinee-facing token endpoints get a generous per-IP ceiling against scraping/enumeration.
  app.use('/api/share', rateLimit({ windowMs: 60 * 1000, max: env.NODE_ENV === 'test' ? 10_000 : 300 }));
  app.use(attachSession(container.auth));
  app.use('/api/auth', createAuthRouter(container.auth));
  // Public quiz retrieval by token. Mounted BEFORE the instructor-guarded /api/quizzes/* routers so
  // /api/quizzes/v/:token is never captured by the /api/quizzes/:id prefix (which would 401).
  app.use('/api/quizzes/v', createShareRouter(container.share));
  app.use('/api/quizzes/:id/invites', createInviteRouter(container.share));
  app.use('/api/quizzes/:id/leaderboard', createInstructorLeaderboardRouter(container.leaderboard));
  app.use('/api/quizzes/:id/export', createReportingRouter(container.reporting));
  app.use('/api/quizzes/:id', createDashboardRouter(container.analytics, container.grading));
  app.use('/api/quizzes', createQuizRouter(container.quizzes));
  app.use('/api/share/:token/attempts/:attemptId/violations', createProctorRouter(container.share, container.proctor));
  app.use('/api/share/:token/attempts', createAttemptRouter(container.share, container.attempts, container.submissions));
  app.use('/api/share', createShareRouter(container.share));
  app.use('/api/uploads', createUploadRouter(env.UPLOAD_DIR));
  app.use(
    '/uploads',
    express.static(path.resolve(env.UPLOAD_DIR), { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny' }),
  );

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
  app.use(errorHandler);

  // Modular monolith: whenever a client build exists it is served from this process with an SPA
  // fallback, so a pasted /quiz/v/:token deep link resolves client-side regardless of NODE_ENV.
  // (Gating this on NODE_ENV=production meant any other start returned Express's raw 404.)
  const dist = clientDist ? path.resolve(clientDist) : '';
  if (dist && fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1y', immutable: true, setHeaders: (res, file) => {
      if (file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    } }));
    app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }
  return app;
}
