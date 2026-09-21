import { Types } from 'mongoose';
import type { Attempt, ExamineeRecord, PublicQuestion } from '@shared';
import { VIOLATION_THRESHOLD } from '@shared';
import { validateExaminee } from '@shared';
import type { QuizDoc } from '@/modules/quiz/quiz.model';
import { toQuiz } from '@/modules/quiz/quiz.model';
import { SubmissionModel, toAttempt, type SubmissionDoc } from './submission.model';
import { badRequest, notFound } from '@/utils/errors';

export interface StartedAttempt {
  attempt: Attempt;
  questions: PublicQuestion[];
  serverTime: string;
}

export interface ViolationReport {
  violations: number;
  threshold: number;
  shouldSubmit: boolean;
}

/** Fisher–Yates on a copy. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Step 1: validates the examinee record against the instructor's dynamic schema. */
export function validateMetadata(quiz: QuizDoc, input: unknown): ExamineeRecord {
  const result = validateExaminee(toQuiz(quiz).examineeFields, input);
  if (!result.success || !result.data) throw badRequest('Please correct the highlighted fields', { fieldErrors: result.errors });
  return result.data;
}

/**
 * Questions as the examinee must see them: answer keys stripped, presented in the order
 * frozen on the attempt (shuffled per attempt when the instructor enabled it).
 */
export function questionsForAttempt(quiz: QuizDoc, attempt: SubmissionDoc): PublicQuestion[] {
  const byId = new Map(toQuiz(quiz).questions.map((q) => [q.id, q]));
  const order = attempt.questionOrder.length ? attempt.questionOrder : [...byId.keys()];
  return order.flatMap((qid) => {
    const q = byId.get(qid);
    if (!q) return [];
    const { correctOptionId: _key, acceptedAnswers: _keys, ...pub } = q;
    const optionOrder = attempt.optionOrder.get(qid);
    if (optionOrder) {
      const opts = new Map(pub.options.map((o) => [o.id, o]));
      pub.options = optionOrder.flatMap((oid) => opts.get(oid) ?? []);
    }
    return [pub];
  });
}

export async function loadAttempt(quiz: QuizDoc, attemptId: string): Promise<SubmissionDoc> {
  const doc = Types.ObjectId.isValid(attemptId) ? await SubmissionModel.findOne({ _id: attemptId, quiz: quiz._id }) : null;
  if (!doc) throw notFound('Attempt not found');
  return doc;
}

const view = (quiz: QuizDoc, attempt: SubmissionDoc): StartedAttempt => ({
  attempt: toAttempt(attempt),
  questions: questionsForAttempt(quiz, attempt),
  serverTime: new Date().toISOString(),
});

/** Step 2 "Start Quiz": opens the timed attempt; the deadline is set here, server-side. */
export async function start(quiz: QuizDoc, examineeInput: unknown): Promise<StartedAttempt> {
  const examinee = validateMetadata(quiz, examineeInput);
  const { settings, questions } = toQuiz(quiz);
  const startedAt = new Date();
  const questionOrder = (settings.shuffleQuestions ? shuffle(questions) : questions).map((q) => q.id);
  const optionOrder = new Map<string, string[]>();
  if (settings.shuffleOptions) {
    for (const q of questions) if (q.type === 'mcq') optionOrder.set(q.id, shuffle(q.options).map((o) => o.id));
  }
  const doc = await SubmissionModel.create({
    quiz: quiz._id,
    examinee,
    questionOrder,
    optionOrder,
    startedAt,
    expiresAt: new Date(startedAt.getTime() + settings.durationSeconds * 1000),
  });
  return view(quiz, doc);
}

/** Page refresh: re-sync against the server clock and the frozen question layout. */
export async function resume(quiz: QuizDoc, attemptId: string): Promise<StartedAttempt> {
  return view(quiz, await loadAttempt(quiz, attemptId));
}

/** Proctoring: records a focus-loss violation; signals auto-submit at the threshold. */
export async function recordViolation(quiz: QuizDoc, attemptId: string, kind: string): Promise<ViolationReport> {
  const doc = await loadAttempt(quiz, attemptId);
  if (doc.status === 'submitted') return { violations: doc.violations, threshold: VIOLATION_THRESHOLD, shouldSubmit: false };
  const updated = await SubmissionModel.findByIdAndUpdate(
    doc._id,
    { $inc: { violations: 1 }, $push: { violationEvents: { kind, at: new Date() } } },
    { new: true },
  );
  const violations = updated?.violations ?? doc.violations + 1;
  return { violations, threshold: VIOLATION_THRESHOLD, shouldSubmit: violations >= VIOLATION_THRESHOLD };
}
