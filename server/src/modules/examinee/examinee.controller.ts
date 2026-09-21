import type { Request, Response } from 'express';
import { z } from 'zod';
import * as attempts from './attempt.service';
import * as submissions from './submission.service';
import { toPublicQuiz } from '@/modules/share';
import { bodyOf } from '@/middleware/validate';

export const StartSchema = z.object({ examinee: z.record(z.union([z.string().max(500), z.number()])).default({}) });
export const SubmitSchema = z.object({
  answers: z.record(z.string().max(10_000)).default({}),
  reason: z.enum(['manual', 'timeout', 'violation']).default('manual'),
});
export const ViolationSchema = z.object({ kind: z.enum(['visibility', 'blur', 'fullscreen-exit', 'shortcut', 'contextmenu']) });

const quiz = (req: Request) => req.quizDoc!;
const attemptId = (req: Request) => req.params.attemptId ?? '';

/** GET /api/quizzes/v/:token — public quiz metadata, answer keys never included. */
export function getPublicQuiz(req: Request, res: Response): void {
  res.json({ quiz: toPublicQuiz(quiz(req)) });
}
export function validate(req: Request, res: Response): void {
  res.json({ examinee: attempts.validateMetadata(quiz(req), bodyOf(req, StartSchema).examinee) });
}
export async function start(req: Request, res: Response): Promise<void> {
  res.status(201).json(await attempts.start(quiz(req), bodyOf(req, StartSchema).examinee));
}
export async function resume(req: Request, res: Response): Promise<void> {
  res.json(await attempts.resume(quiz(req), attemptId(req)));
}
export async function violation(req: Request, res: Response): Promise<void> {
  res.json(await attempts.recordViolation(quiz(req), attemptId(req), bodyOf(req, ViolationSchema).kind));
}
export async function submit(req: Request, res: Response): Promise<void> {
  res.json({ receipt: await submissions.submit(quiz(req), attemptId(req), bodyOf(req, SubmitSchema)) });
}
export async function result(req: Request, res: Response): Promise<void> {
  res.json({ receipt: await submissions.receipt(quiz(req), attemptId(req)) });
}
