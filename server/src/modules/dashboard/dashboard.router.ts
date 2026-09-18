import { Router } from 'express';
import type { AnalyticsService } from './analytics.service';
import { requireInstructor } from '@/modules/auth';

/** Mounted at `/api/quizzes/:id` (analytics + raw submissions for the instructor panel). */
export function createDashboardRouter(analytics: AnalyticsService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireInstructor);
  const id = (req: import('express').Request) => String((req.params as Record<string, string>)['id']);

  router.get('/analytics', (req, res) => {
    res.json({ analytics: analytics.forQuiz(req.instructor!.id, id(req)) });
  });
  router.get('/submissions', (req, res) => {
    res.json({ submissions: analytics.listSubmissions(req.instructor!.id, id(req)) });
  });
  return router;
}
