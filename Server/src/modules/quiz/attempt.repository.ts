import type { Db } from '@/db/prisma';
import { parseJson } from '@/db/prisma';
import type { Attempt, ExamineeRecord, Submission, AnswerMap } from '@shared';
import type { Attempt as AttemptRow, Submission as SubmissionRow } from '@prisma/client';

const toAttempt = (r: AttemptRow): Attempt => ({
  id: r.id,
  quizId: r.quizId,
  examinee: parseJson<ExamineeRecord>(r.examinee, {}),
  status: r.status as Attempt['status'],
  startedAt: r.startedAt.toISOString(),
  expiresAt: r.expiresAt.toISOString(),
  violations: r.violations,
});

const toSubmission = (r: SubmissionRow): Submission => ({
  id: r.id,
  quizId: r.quizId,
  attemptId: r.attemptId,
  examinee: parseJson<ExamineeRecord>(r.examinee, {}),
  answers: parseJson<AnswerMap>(r.answers, {}),
  score: r.score,
  maxScore: r.maxScore,
  durationSeconds: r.durationSeconds,
  startedAt: r.startedAt.toISOString(),
  submittedAt: r.submittedAt.toISOString(),
  violations: r.violations,
  reason: r.reason as Submission['reason'],
});

export interface AttemptRepository {
  insertAttempt(attempt: Attempt): Promise<void>;
  findAttempt(id: string): Promise<Attempt | null>;
  markSubmitted(id: string): Promise<void>;
  incrementViolations(id: string, kind: string, occurredAt: string, eventId: string): Promise<number>;
  insertSubmission(submission: Submission): Promise<void>;
  updateScore(submissionId: string, score: number, maxScore: number): Promise<void>;
  findSubmission(id: string): Promise<Submission | null>;
  findSubmissionByAttempt(attemptId: string): Promise<Submission | null>;
  listSubmissions(quizId: string): Promise<Submission[]>;
  countSubmissions(quizId: string): Promise<number>;
}

/** Bound to a Prisma client OR an interactive-transaction client (same surface). */
export function createAttemptRepository(db: Db): AttemptRepository {
  return {
    async insertAttempt(a) {
      await db.attempt.create({
        data: { id: a.id, quizId: a.quizId, examinee: JSON.stringify(a.examinee), status: a.status, startedAt: new Date(a.startedAt), expiresAt: new Date(a.expiresAt), violations: a.violations },
      });
    },
    async findAttempt(id) {
      const row = await db.attempt.findUnique({ where: { id } });
      return row ? toAttempt(row) : null;
    },
    async markSubmitted(id) {
      await db.attempt.update({ where: { id }, data: { status: 'submitted' } });
    },
    async incrementViolations(id, kind, occurredAt, eventId) {
      const [, updated] = await db.$transaction([
        db.violationEvent.create({ data: { id: eventId, attemptId: id, kind, occurredAt: new Date(occurredAt) } }),
        db.attempt.update({ where: { id }, data: { violations: { increment: 1 } } }),
      ]);
      return updated.violations;
    },
    async insertSubmission(s) {
      await db.submission.create({
        data: {
          id: s.id, quizId: s.quizId, attemptId: s.attemptId, examinee: JSON.stringify(s.examinee), answers: JSON.stringify(s.answers),
          score: s.score, maxScore: s.maxScore, durationSeconds: s.durationSeconds, startedAt: new Date(s.startedAt),
          submittedAt: new Date(s.submittedAt), violations: s.violations, reason: s.reason,
        },
      });
    },
    async updateScore(id, score, maxScore) {
      await db.submission.update({ where: { id }, data: { score, maxScore } });
    },
    async findSubmission(id) {
      const row = await db.submission.findUnique({ where: { id } });
      return row ? toSubmission(row) : null;
    },
    async findSubmissionByAttempt(attemptId) {
      const row = await db.submission.findUnique({ where: { attemptId } });
      return row ? toSubmission(row) : null;
    },
    async listSubmissions(quizId) {
      return (await db.submission.findMany({ where: { quizId }, orderBy: { submittedAt: 'asc' } })).map(toSubmission);
    },
    countSubmissions: (quizId) => db.submission.count({ where: { quizId } }),
  };
}
