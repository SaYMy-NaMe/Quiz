import type { AnswerMap, SubmissionReason, SubmissionReceipt, Submission } from '@shared';
import { SUBMISSION_GRACE_SECONDS } from '@shared';
import type { QuizDoc } from '@/modules/quiz/quiz.model';
import { toQuiz } from '@/modules/quiz/quiz.model';
import { SubmissionModel, toSubmission, type SubmissionDoc } from './submission.model';
import { loadAttempt } from './attempt.service';
import { grade } from './grading';
import { badRequest, notFound } from '@/utils/errors';
import { logger } from '@/services/logger';

export interface SubmitInput {
  answers: AnswerMap;
  reason: SubmissionReason;
}

function toReceipt(quiz: QuizDoc, doc: SubmissionDoc): SubmissionReceipt {
  const { settings, questions } = toQuiz(quiz);
  const showScore = settings.revealScores || settings.revealAnswers;
  const receipt: SubmissionReceipt = {
    submissionId: doc._id.toString(),
    score: showScore ? doc.score : null,
    maxScore: showScore ? doc.maxScore : null,
    needsReview: doc.needsReview,
    durationSeconds: doc.durationSeconds,
    submittedAt: (doc.submittedAt ?? doc.startedAt).toISOString(),
    reason: doc.reason,
  };
  if (settings.revealAnswers) receipt.breakdown = grade(questions, Object.fromEntries(doc.answers), Object.fromEntries(doc.manualScores)).breakdown;
  return receipt;
}

/** Step 3: evaluates and stores the attempt. Idempotent — a retried submit returns the stored result. */
export async function submit(quiz: QuizDoc, attemptId: string, { answers, reason }: SubmitInput): Promise<SubmissionReceipt> {
  const doc = await loadAttempt(quiz, attemptId);
  if (doc.status === 'submitted') return toReceipt(quiz, doc);

  const { questions, settings } = toQuiz(quiz);
  const missing = questions.filter((q) => q.required && !(answers[q.id] ?? '').trim()).map((q) => q.id);
  // Required questions block a *manual* submit only; timeouts and violations submit whatever exists.
  if (reason === 'manual' && missing.length) throw badRequest('Please answer every required question', { missing });

  const submittedAt = new Date();
  const overrunSeconds = (submittedAt.getTime() - doc.expiresAt.getTime()) / 1000;
  if (overrunSeconds > SUBMISSION_GRACE_SECONDS) logger.warn({ attemptId, overrunSeconds }, 'Late submission accepted as timeout');

  const result = grade(questions, answers);
  doc.set({
    status: 'submitted',
    answers,
    score: result.score,
    maxScore: result.maxScore,
    needsReview: result.needsReview,
    submittedAt,
    durationSeconds: Math.min(Math.round((submittedAt.getTime() - doc.startedAt.getTime()) / 1000), settings.durationSeconds),
    // The server clock is authoritative: anything past the deadline is a timeout.
    reason: overrunSeconds > 0 ? 'timeout' : reason,
  });
  await doc.save();
  return toReceipt(quiz, doc);
}

export async function receipt(quiz: QuizDoc, attemptId: string): Promise<SubmissionReceipt> {
  const doc = await loadAttempt(quiz, attemptId);
  if (doc.status !== 'submitted') throw notFound('No submission for this attempt');
  return toReceipt(quiz, doc);
}

/** Instructor: all submitted attempts of a quiz, oldest first. */
export async function listSubmitted(quiz: QuizDoc): Promise<Submission[]> {
  const docs = await SubmissionModel.find({ quiz: quiz._id, status: 'submitted' }).sort({ submittedAt: 1 });
  return docs.map(toSubmission);
}

/** Instructor: assigns points to manually graded questions and re-scores the submission. */
export async function gradeManually(quiz: QuizDoc, submissionId: string, grades: Record<string, number>): Promise<Submission> {
  const doc = await loadAttempt(quiz, submissionId);
  if (doc.status !== 'submitted') throw notFound('No submission for this attempt');
  const questions = toQuiz(quiz).questions;
  for (const [qid, pts] of Object.entries(grades)) {
    const q = questions.find((x) => x.id === qid);
    if (!q || q.type === 'mcq') throw badRequest(`Question ${qid} is not manually graded`);
    doc.manualScores.set(qid, Math.min(q.points, Math.max(0, pts)));
  }
  return rescore(quiz, doc);
}

/** Re-runs evaluation against the current answer keys (after an unpublish → fix → republish). */
export async function regradeAll(quiz: QuizDoc): Promise<{ regraded: number; changed: number }> {
  const docs = await SubmissionModel.find({ quiz: quiz._id, status: 'submitted' });
  let changed = 0;
  for (const doc of docs) {
    const before = doc.score;
    await rescore(quiz, doc);
    if (doc.score !== before) changed += 1;
  }
  return { regraded: docs.length, changed };
}

async function rescore(quiz: QuizDoc, doc: SubmissionDoc): Promise<Submission> {
  const result = grade(toQuiz(quiz).questions, Object.fromEntries(doc.answers), Object.fromEntries(doc.manualScores));
  doc.set({ score: result.score, maxScore: result.maxScore, needsReview: result.needsReview });
  await doc.save();
  return toSubmission(doc);
}
