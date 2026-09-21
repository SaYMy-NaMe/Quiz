import type { Request, Response } from 'express';
import { z } from 'zod';
import { ownedQuiz, toQuiz } from '@/modules/quiz';
import { listSubmitted, gradeManually, regradeAll } from '@/modules/examinee';
import { rank } from '@/modules/leaderboard/leaderboard.service';
import { computeAnalytics } from './analytics.service';
import { writeSubmissionsWorkbook, safeFilename } from '@/modules/reporting/excel.exporter';
import { bodyOf } from '@/middleware/validate';

export const GradeSchema = z.object({ grades: z.record(z.number().min(0).max(1000)) });

const load = (req: Request) => ownedQuiz(req.instructor!.id, req.params.id ?? '');

export async function leaderboard(req: Request, res: Response): Promise<void> {
  const quiz = await load(req);
  res.json({ leaderboard: rank(quiz, await listSubmitted(quiz)) });
}
export async function analytics(req: Request, res: Response): Promise<void> {
  const quiz = await load(req);
  res.json({ analytics: computeAnalytics(toQuiz(quiz), await listSubmitted(quiz)) });
}
export async function submissions(req: Request, res: Response): Promise<void> {
  res.json({ submissions: await listSubmitted(await load(req)) });
}
export async function gradeSubmission(req: Request, res: Response): Promise<void> {
  res.json({ submission: await gradeManually(await load(req), req.params.submissionId ?? '', bodyOf(req, GradeSchema).grades) });
}
export async function regrade(req: Request, res: Response): Promise<void> {
  const quiz = await load(req);
  res.json({ result: { quizId: quiz._id.toString(), ...(await regradeAll(quiz)) } });
}
export async function exportXlsx(req: Request, res: Response): Promise<void> {
  const doc = await load(req);
  const quiz = toQuiz(doc);
  const subs = await listSubmitted(doc);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  res.status(200);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(quiz.title)}-submissions-${stamp}.xlsx"`);
  res.setHeader('Cache-Control', 'no-store');
  await writeSubmissionsWorkbook(res, { quiz, submissions: subs, leaderboard: rank(doc, subs), analytics: computeAnalytics(quiz, subs) });
}
