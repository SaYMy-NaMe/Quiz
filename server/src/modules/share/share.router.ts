import { Router } from 'express';
import { z } from 'zod';
import type { ShareService } from './share.service';
import { resolveShare } from './share.middleware';
import { requireInstructor } from '@/modules/auth';
import { validateBody, bodyOf } from '@/middleware/validate';
import { asyncHandler } from '@/middleware/async-handler';

const AddInvitesSchema = z.object({
  emails: z.array(z.string().trim().email().max(200)).min(1).max(500),
});

/** Public, token-scoped endpoints: `/api/share/:token/...` */
export function createShareRouter(share: ShareService): Router {
  const router = Router();
  router.get('/:token', resolveShare(share), (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ quiz: share.toPublicQuiz(req.share!) });
  });
  return router;
}

/** Instructor-only invite management, mounted under `/api/quizzes/:id/invites`. */
export function createInviteRouter(share: ShareService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireInstructor);
  const owner = (req: import('express').Request) => req.instructor!.id;
  const quizId = (req: import('express').Request) => String(req.params.id);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json({ invites: await share.listInvites(owner(req), quizId(req)) });
    }),
  );
  router.post(
    '/',
    validateBody(AddInvitesSchema),
    asyncHandler(async (req, res) => {
      res.status(201).json({ invites: await share.addInvites(owner(req), quizId(req), bodyOf(req, AddInvitesSchema).emails) });
    }),
  );
  router.delete(
    '/:inviteId',
    asyncHandler(async (req, res) => {
      await share.removeInvite(owner(req), quizId(req), req.params.inviteId ?? '');
      res.status(204).end();
    }),
  );
  return router;
}
