import { Router } from 'express';
import { z } from 'zod';
import type { AttemptService } from './attempt.service';
import type { SubmissionService } from './submission.service';
import type { ShareService } from '@/modules/share';
import { resolveShare } from '@/modules/share';
import { validateBody, bodyOf } from '@/middleware/validate';
import { asyncHandler } from '@/middleware/async-handler';

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
  const attemptId = (req: import('express').Request) => String(req.params.attemptId);

  router.post('/validate', validateBody(StartSchema), resolveShare(share), (req, res) => {
    res.json({ examinee: attempts.validateExaminee(req.share!, bodyOf(req, StartSchema).examinee) });
  });

  router.post(
    '/',
    validateBody(StartSchema),
    resolveShare(share),
    asyncHandler(async (req, res) => {
      res.status(201).json(await attempts.start(req.share!, bodyOf(req, StartSchema).examinee));
    }),
  );

  router.get(
    '/:attemptId',
    resolveShare(share),
    asyncHandler(async (req, res) => {
      res.json(await attempts.resume(req.share!, attemptId(req)));
    }),
  );

  router.post(
    '/:attemptId/submit',
    validateBody(SubmitSchema),
    resolveShare(share),
    asyncHandler(async (req, res) => {
      const { answers, reason } = bodyOf(req, SubmitSchema);
      res.json({ receipt: await submissions.submit(req.share!, attemptId(req), { answers, reason }) });
    }),
  );

  router.get(
    '/:attemptId/result',
    resolveShare(share),
    asyncHandler(async (req, res) => {
      res.json({ receipt: await submissions.receipt(req.share!, attemptId(req)) });
    }),
  );

  return router;
}
