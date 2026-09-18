import { Router, type Request } from 'express';
import type { QuizService } from './quiz.service';
import { QuizUpsertSchema } from './quiz.schemas';
import { requireInstructor } from '@/modules/auth';
import { validateBody, bodyOf } from '@/middleware/validate';
import { asyncHandler } from '@/middleware/async-handler';

export function createQuizRouter(quizzes: QuizService): Router {
  const router = Router();
  router.use(requireInstructor);

  const owner = (req: Request) => req.instructor!.id;
  const id = (req: Request) => req.params.id ?? '';

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json({ quizzes: await quizzes.list(owner(req)) });
    }),
  );

  router.post(
    '/',
    validateBody(QuizUpsertSchema),
    asyncHandler(async (req, res) => {
      res.status(201).json({ quiz: await quizzes.create(owner(req), bodyOf(req, QuizUpsertSchema)) });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      res.json({ quiz: await quizzes.get(owner(req), id(req)) });
    }),
  );

  router.put(
    '/:id',
    validateBody(QuizUpsertSchema),
    asyncHandler(async (req, res) => {
      res.json({ quiz: await quizzes.update(owner(req), id(req), bodyOf(req, QuizUpsertSchema)) });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await quizzes.delete(owner(req), id(req));
      res.status(204).end();
    }),
  );

  /** Lifecycle transitions share one shape: (owner, id) -> updated quiz. */
  const action = (fn: (ownerId: string, quizId: string) => Promise<unknown>) =>
    asyncHandler(async (req, res) => {
      res.json({ quiz: await fn(owner(req), id(req)) });
    });
  router.post('/:id/publish', action((o, q) => quizzes.publish(o, q)));
  router.post('/:id/unpublish', action((o, q) => quizzes.unpublish(o, q)));
  router.post('/:id/close', action((o, q) => quizzes.close(o, q)));
  router.post('/:id/reopen', action((o, q) => quizzes.reopen(o, q)));
  router.post('/:id/rotate-token', action((o, q) => quizzes.rotateShareToken(o, q)));

  return router;
}
