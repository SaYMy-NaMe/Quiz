import { Router } from 'express';
import type { LeaderboardService } from './leaderboard.service';
import { requireInstructor } from '@/modules/auth';

/** Instructor endpoint mounted at `/api/quizzes/:id/leaderboard`. */
export function createInstructorLeaderboardRouter(leaderboard: LeaderboardService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireInstructor);
  router.get('/', (req, res) => {
    const { id } = req.params as Record<string, string>;
    res.json({ leaderboard: leaderboard.forInstructor(req.instructor!.id, String(id)) });
  });
  return router;
}
