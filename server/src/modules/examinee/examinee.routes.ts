import { Router } from 'express';
import * as c from './examinee.controller';
import { resolveShare } from '@/modules/share';
import { validateBody } from '@/middleware/validate';
import { asyncHandler } from '@/middleware/async-handler';

/**
 * Public, token-scoped routes. Mounted at `/api/quizzes/v` (and `/api/share` as an alias).
 * No authentication: the share token is the credential.
 */
export const examineeRoutes = Router();
examineeRoutes.use('/:token', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
}, resolveShare);

examineeRoutes.get('/:token', c.getPublicQuiz);
examineeRoutes.post('/:token/attempts/validate', validateBody(c.StartSchema), c.validate);
examineeRoutes.post('/:token/attempts', validateBody(c.StartSchema), asyncHandler(c.start));
examineeRoutes.get('/:token/attempts/:attemptId', asyncHandler(c.resume));
examineeRoutes.post('/:token/attempts/:attemptId/violations', validateBody(c.ViolationSchema), asyncHandler(c.violation));
examineeRoutes.post('/:token/attempts/:attemptId/submit', validateBody(c.SubmitSchema), asyncHandler(c.submit));
examineeRoutes.get('/:token/attempts/:attemptId/result', asyncHandler(c.result));
// Anything else under a token is unknown here — never let it fall through to instructor routers.
examineeRoutes.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }));
