import { Router } from 'express';
import * as c from './dashboard.controller';
import { requireInstructor } from '@/modules/auth';
import { validateBody } from '@/middleware/validate';
import { asyncHandler } from '@/middleware/async-handler';

/** Instructor-only reporting, mounted at `/api/quizzes/:id`. */
export const dashboardRoutes = Router({ mergeParams: true });
dashboardRoutes.use(requireInstructor);
dashboardRoutes.get('/leaderboard', asyncHandler(c.leaderboard));
dashboardRoutes.get('/analytics', asyncHandler(c.analytics));
dashboardRoutes.get('/submissions', asyncHandler(c.submissions));
dashboardRoutes.patch('/submissions/:submissionId/grade', validateBody(c.GradeSchema), asyncHandler(c.gradeSubmission));
dashboardRoutes.post('/regrade', asyncHandler(c.regrade));
dashboardRoutes.get('/export/xlsx', asyncHandler(c.exportXlsx));
