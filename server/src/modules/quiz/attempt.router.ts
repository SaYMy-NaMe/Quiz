import { Router } from 'express';
import { z } from 'zod';
import type { AttemptService } from './attempt.service';
import type { SubmissionService } from './submission.service';
import type { ShareService } from '@/modules/share';
import { resolveShare } from '@/modules/share';
import { validateBody, bodyOf } from '@/middleware/validate';

const SubmitSchema = z.object({
  inviteToken: z.string().max(64).optional(),
  answers: z.record(z.string().max(64)).default({}),
  reason: z.enum(['manual', 'timeout', 'violation']).default('manual'),
});

const StartSchema = z.object({
  inviteToken: z.string().max(64).optional(),
  examinee: z.record(z.union([z.string().max(500), z.number()])).default({}),
});

/** Mounted at `/api/share/:token/attempts`; every route passes the access middleware. */
export function createAttemptRouter(share: ShareService, attempts: AttemptService, submissions: SubmissionService): Router {
  const router = Router({ mergeParams: true });
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.post('/validate', validateBody(StartSchema), resolveShare(share), (req, res) => {
    res.json({ examinee: attempts.validateExaminee(req.share!, bodyOf(req, StartSchema).examinee) });
  });

  router.post('/', validateBody(StartSchema), resolveShare(share), (req, res) => {
    res.status(201).json(attempts.start(req.share!, bodyOf(req, StartSchema).examinee));
  });

  router.get('/:attemptId', resolveShare(share), (req, res) => {
    res.json(attempts.resume(req.share!, String(req.params.attemptId)));
  });

  router.post('/:attemptId/submit', validateBody(SubmitSchema), resolveShare(share), (req, res) => {
    const { answers, reason } = bodyOf(req, SubmitSchema);
    res.json({ receipt: submissions.submit(req.share!, String(req.params.attemptId), { answers, reason }) });
  });

  router.get('/:attemptId/result', resolveShare(share), (req, res) => {
    res.json({ receipt: submissions.receipt(req.share!, String(req.params.attemptId)) });
  });

  return router;
}
