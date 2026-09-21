import type { Request, Response } from 'express';
import * as quizzes from './quiz.service';
import { QuizUpsertSchema } from './quiz.schemas';
import { bodyOf } from '@/middleware/validate';
import type { QuizAction } from './quiz.state';

const owner = (req: Request) => req.instructor!.id;
const id = (req: Request) => req.params.id ?? '';

export async function list(req: Request, res: Response): Promise<void> {
  res.json({ quizzes: await quizzes.list(owner(req)) });
}
export async function create(req: Request, res: Response): Promise<void> {
  res.status(201).json({ quiz: await quizzes.create(owner(req), bodyOf(req, QuizUpsertSchema)) });
}
export async function get(req: Request, res: Response): Promise<void> {
  res.json({ quiz: await quizzes.get(owner(req), id(req)) });
}
export async function update(req: Request, res: Response): Promise<void> {
  res.json({ quiz: await quizzes.update(owner(req), id(req), bodyOf(req, QuizUpsertSchema)) });
}
export async function remove(req: Request, res: Response): Promise<void> {
  await quizzes.remove(owner(req), id(req));
  res.status(204).end();
}
export const lifecycle = (action: QuizAction) => async (req: Request, res: Response): Promise<void> => {
  res.json({ quiz: await quizzes.applyAction(owner(req), id(req), action) });
};
export async function rotateToken(req: Request, res: Response): Promise<void> {
  res.json({ quiz: await quizzes.rotateShareToken(owner(req), id(req)) });
}
export function uploadImage(req: Request, res: Response): void {
  res.status(201).json({ url: `/uploads/${req.file!.filename}` });
}
