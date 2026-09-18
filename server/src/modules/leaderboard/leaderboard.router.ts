import { Router } from 'express';
import type { LeaderboardService } from './leaderboard.service';
import { requireInstructor } from '@/modules/auth';
import { asyncHandler } from '@/middleware/async-handler';

/** Instructor endpoint mounted at `/api/quizzes/:id/leaderboard`. */
export function createInstructorLeaderboardRouter(leaderboard: LeaderboardService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireInstructor);
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { id } = req.params as Record<string, string>;
      res.json({ leaderboard: await leaderboard.forInstructor(req.instructor!.id, String(id)) });
    }),
  );
  return router;
}
