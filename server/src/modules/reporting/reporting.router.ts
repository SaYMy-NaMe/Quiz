import { Router } from 'express';
import type { ReportingService } from './reporting.service';
import { requireInstructor } from '@/modules/auth';
import { asyncHandler } from '@/middleware/async-handler';

/** Mounted at `/api/quizzes/:id/export`. */
export function createReportingRouter(reporting: ReportingService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireInstructor);

  router.get(
    '/xlsx',
    asyncHandler(async (req, res) => {
      const { id } = req.params as Record<string, string>;
      const prepared = await reporting.prepareSubmissionsExport(req.instructor!.id, String(id));
      res.status(200);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${prepared.filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      // Server-side streaming: exceljs writes zip chunks directly into the response.
      await prepared.write(res);
    }),
  );

  return router;
}
