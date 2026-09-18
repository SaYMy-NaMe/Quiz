import { Router } from 'express';
import { z } from 'zod';
import type { AttemptService } from './attempt.service';
import type { ShareService } from '@/modules/share';
import { resolveShare } from '@/modules/share';
import { validateBody } from '@/middleware/validate';

const StartSchema = z.object({
  inviteToken: z.string().max(64).optional(),
  examinee: z.record(z.union([z.string().max(500), z.number()])).default({}),
});

/** Mounted at `/api/share/:token/attempts`; every route passes the access middleware. */
export function createAttemptRouter(share: ShareService, attempts: AttemptService): Router {
  const router = Router({ mergeParams: true });
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.post('/', validateBody(StartSchema), resolveShare(share), (req, res) => {
    res.status(201).json(attempts.start(req.share!, req.body.examinee));
  });

  router.get('/:attemptId', resolveShare(share), (req, res) => {
    res.json(attempts.resume(req.share!, String(req.params['attemptId'])));
  });

  return router;
}
