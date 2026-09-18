import { Router } from 'express';
import { z } from 'zod';
import type { ProctorService } from './proctor.service';
import type { ShareService } from '@/modules/share';
import { resolveShare } from '@/modules/share';
import { validateBody, bodyOf } from '@/middleware/validate';
import { asyncHandler } from '@/middleware/async-handler';

const ViolationSchema = z.object({
  inviteToken: z.string().max(64).optional(),
  kind: z.enum(['visibility', 'blur', 'fullscreen-exit', 'shortcut', 'contextmenu']),
});

/** Mounted at `/api/share/:token/attempts/:attemptId/violations`. */
export function createProctorRouter(share: ShareService, proctor: ProctorService): Router {
  const router = Router({ mergeParams: true });
  router.post(
    '/',
    validateBody(ViolationSchema),
    resolveShare(share),
    asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await proctor.record(req.share!, String(req.params.attemptId), bodyOf(req, ViolationSchema).kind));
    }),
  );
  return router;
}
