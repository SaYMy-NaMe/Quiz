import { Router } from 'express';
import type { AnalyticsService } from './analytics.service';
import type { GradingService } from '@/modules/quiz';
import { requireInstructor } from '@/modules/auth';
import { asyncHandler } from '@/middleware/async-handler';

/** Mounted at `/api/quizzes/:id` (analytics + raw submissions for the instructor panel). */
export function createDashboardRouter(analytics: AnalyticsService, grading: GradingService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireInstructor);
  const id = (req: import('express').Request) => String((req.params as Record<string, string>).id);

  router.get(
    '/analytics',
    asyncHandler(async (req, res) => {
      res.json({ analytics: await analytics.forQuiz(req.instructor!.id, id(req)) });
    }),
  );
  router.post(
    '/regrade',
    asyncHandler(async (req, res) => {
      res.json({ result: await grading.regrade(req.instructor!.id, id(req)) });
    }),
  );
  router.get(
    '/submissions',
    asyncHandler(async (req, res) => {
      res.json({ submissions: await analytics.listSubmissions(req.instructor!.id, id(req)) });
    }),
  );
  return router;
}
