import type { Db } from '@/services/database';
import type { Attempt, ExamineeRecord, Submission, AnswerMap } from '@shared';
import { parseJson } from '@/utils/json';

interface AttemptRow {
  id: string;
  quiz_id: string;
  examinee: string;
  status: Attempt['status'];
  started_at: string;
  expires_at: string;
  violations: number;
}

interface SubmissionRow {
  id: string;
  quiz_id: string;
  attempt_id: string;
  examinee: string;
  answers: string;
  score: number;
  max_score: number;
  duration_seconds: number;
  started_at: string;
  submitted_at: string;
  violations: number;
  reason: Submission['reason'];
}

const toAttempt = (r: AttemptRow): Attempt => ({
  id: r.id,
  quizId: r.quiz_id,
  examinee: parseJson<ExamineeRecord>(r.examinee, {}),
  status: r.status,
  startedAt: r.started_at,
  expiresAt: r.expires_at,
  violations: r.violations,
});

const toSubmission = (r: SubmissionRow): Submission => ({
  id: r.id,
  quizId: r.quiz_id,
  attemptId: r.attempt_id,
  examinee: parseJson<ExamineeRecord>(r.examinee, {}),
  answers: parseJson<AnswerMap>(r.answers, {}),
  score: r.score,
  maxScore: r.max_score,
  durationSeconds: r.duration_seconds,
  startedAt: r.started_at,
  submittedAt: r.submitted_at,
  violations: r.violations,
  reason: r.reason,
});

export interface AttemptRepository {
  insertAttempt(attempt: Attempt): void;
  findAttempt(id: string): Attempt | null;
  markSubmitted(id: string): void;
  incrementViolations(id: string, kind: string, occurredAt: string, eventId: string): number;
  insertSubmission(submission: Submission): void;
  updateScore(submissionId: string, score: number, maxScore: number): void;
  findSubmission(id: string): Submission | null;
  findSubmissionByAttempt(attemptId: string): Submission | null;
  listSubmissions(quizId: string): Submission[];
  countSubmissions(quizId: string): number;
}

export function createAttemptRepository(db: Db): AttemptRepository {
  return {
    insertAttempt(a) {
      db.prepare(
        'INSERT INTO attempts (id, quiz_id, examinee, status, started_at, expires_at, violations) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(a.id, a.quizId, JSON.stringify(a.examinee), a.status, a.startedAt, a.expiresAt, a.violations);
    },
    findAttempt(id) {
      const row = db.prepare('SELECT * FROM attempts WHERE id = ?').get(id) as AttemptRow | undefined;
      return row ? toAttempt(row) : null;
    },
    markSubmitted(id) {
      db.prepare("UPDATE attempts SET status = 'submitted' WHERE id = ?").run(id);
    },
    incrementViolations(id, kind, occurredAt, eventId) {
      db.prepare('INSERT INTO violation_events (id, attempt_id, kind, occurred_at) VALUES (?, ?, ?, ?)').run(eventId, id, kind, occurredAt);
      db.prepare('UPDATE attempts SET violations = violations + 1 WHERE id = ?').run(id);
      const row = db.prepare('SELECT violations FROM attempts WHERE id = ?').get(id) as { violations: number } | undefined;
      return row?.violations ?? 0;
    },
    insertSubmission(s) {
      db.prepare(
        `INSERT INTO submissions (id, quiz_id, attempt_id, examinee, answers, score, max_score, duration_seconds,
          started_at, submitted_at, violations, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        s.id, s.quizId, s.attemptId, JSON.stringify(s.examinee), JSON.stringify(s.answers), s.score, s.maxScore,
        s.durationSeconds, s.startedAt, s.submittedAt, s.violations, s.reason,
      );
    },
    updateScore(id, score, maxScore) {
      db.prepare('UPDATE submissions SET score = ?, max_score = ? WHERE id = ?').run(score, maxScore, id);
    },
    findSubmission(id) {
      const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id) as SubmissionRow | undefined;
      return row ? toSubmission(row) : null;
    },
    findSubmissionByAttempt(attemptId) {
      const row = db.prepare('SELECT * FROM submissions WHERE attempt_id = ?').get(attemptId) as SubmissionRow | undefined;
      return row ? toSubmission(row) : null;
    },
    listSubmissions(quizId) {
      return (db.prepare('SELECT * FROM submissions WHERE quiz_id = ? ORDER BY submitted_at ASC').all(quizId) as unknown as SubmissionRow[]).map(toSubmission);
    },
    countSubmissions(quizId) {
      const row = db.prepare('SELECT COUNT(*) AS n FROM submissions WHERE quiz_id = ?').get(quizId) as { n: number };
      return row.n;
    },
  };
}
