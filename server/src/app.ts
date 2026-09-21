import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import path from 'node:path';
import fs from 'node:fs';
import { env, isProduction, allowedOrigins } from '@/config/env';
import { logger } from '@/services/logger';
import { createCorsMiddleware } from '@/middleware/cors';
import { rateLimit } from '@/middleware/rate-limit';
import { errorHandler } from '@/middleware/error-handler';
import { attachInstructor, authRoutes } from '@/modules/auth';
import { quizRoutes, uploadRoutes } from '@/modules/quiz';
import { examineeRoutes } from '@/modules/examinee';
import { dashboardRoutes } from '@/modules/dashboard/dashboard.routes';

export function createApp(clientDist: string = env.CLIENT_DIST): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Only meaningful behind TLS; on plain http it breaks assets for other devices.
          ...(isProduction ? {} : { 'upgrade-insecure-requests': null }),
        },
      },
    }),
  );
  app.use(createCorsMiddleware(allowedOrigins));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV !== 'test') app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

  app.use(attachInstructor);
  app.use('/api/auth', authRoutes);
  // Public examinee routes go BEFORE the instructor-guarded /api/quizzes/:id routers so that
  // /api/quizzes/v/:token is never captured by the `:id` prefix.
  app.use('/api/quizzes/v', rateLimit({ windowMs: 60_000, max: env.NODE_ENV === 'test' ? 10_000 : 300 }), examineeRoutes);
  app.use('/api/share', rateLimit({ windowMs: 60_000, max: env.NODE_ENV === 'test' ? 10_000 : 300 }), examineeRoutes);
  app.use('/api/quizzes/:id', dashboardRoutes);
  app.use('/api/quizzes', quizRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR), { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny' }));

  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }));
  app.use(errorHandler);

  // Single-service deployments: serve the client build with an SPA fallback when it exists.
  const dist = clientDist ? path.resolve(clientDist) : '';
  if (dist && fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1y', immutable: true }));
    app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }
  return app;
}
