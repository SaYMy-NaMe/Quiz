import { Router } from 'express';
import { z } from 'zod';
import type { QuizService } from './quiz.service';
import { QuizUpsertSchema } from './quiz.schemas';
import { requireInstructor } from '@/modules/auth';
import { validateBody } from '@/middleware/validate';

const VisibilitySchema = z.object({ visible: z.boolean() });

export function createQuizRouter(quizzes: QuizService): Router {
  const router = Router();
  router.use(requireInstructor);

  const owner = (req: import('express').Request) => req.instructor!.id;
  const id = (req: import('express').Request) => String(req.params['id']);

  router.get('/', (req, res) => {
    res.json({ quizzes: quizzes.list(owner(req)) });
  });

  router.post('/', validateBody(QuizUpsertSchema), (req, res) => {
    res.status(201).json({ quiz: quizzes.create(owner(req), req.body) });
  });

  router.get('/:id', (req, res) => {
    res.json({ quiz: quizzes.get(owner(req), id(req)) });
  });

  router.put('/:id', validateBody(QuizUpsertSchema), (req, res) => {
    res.json({ quiz: quizzes.update(owner(req), id(req), req.body) });
  });

  router.delete('/:id', (req, res) => {
    quizzes.delete(owner(req), id(req));
    res.status(204).end();
  });

  router.post('/:id/publish', (req, res) => res.json({ quiz: quizzes.publish(owner(req), id(req)) }));
  router.post('/:id/unpublish', (req, res) => res.json({ quiz: quizzes.unpublish(owner(req), id(req)) }));
  router.post('/:id/close', (req, res) => res.json({ quiz: quizzes.close(owner(req), id(req)) }));
  router.post('/:id/reopen', (req, res) => res.json({ quiz: quizzes.reopen(owner(req), id(req)) }));

  router.patch('/:id/leaderboard-visibility', validateBody(VisibilitySchema), (req, res) => {
    res.json({ quiz: quizzes.setLeaderboardVisibility(owner(req), id(req), req.body.visible) });
  });

  return router;
}
