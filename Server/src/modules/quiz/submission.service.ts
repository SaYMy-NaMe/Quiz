import type { AnswerMap, Quiz, Submission, SubmissionReason, SubmissionReceipt, Attempt } from '@shared';
import { SUBMISSION_GRACE_SECONDS } from '@shared';
import type { ResolvedShare } from '@/modules/share';
import { createAttemptRepository, type AttemptRepository } from './attempt.repository';
import type { GradingStrategy } from './grading.strategy';
import type { EventBus } from '@/services/event-bus';
import { transaction, type Db } from '@/db/prisma';
import { notFound } from '@/utils/errors';
import { newId } from '@/utils/ids';
import { nowIso, secondsBetween } from '@/utils/time';
import { logger } from '@/services/logger';

export interface SubmitInput {
  answers: AnswerMap;
  reason: SubmissionReason;
}

export interface SubmissionService {
  submit(share: ResolvedShare, attemptId: string, input: SubmitInput): Promise<SubmissionReceipt>;
  receipt(share: ResolvedShare, attemptId: string): Promise<SubmissionReceipt>;
}

interface Deps {
  db: Db;
  repo: AttemptRepository;
  grading: GradingStrategy;
  events: EventBus;
}

export function createSubmissionService({ db, repo, grading, events }: Deps): SubmissionService {
  const toReceipt = (quiz: Quiz, s: Submission): SubmissionReceipt => {
    const showScore = quiz.revealScores || quiz.revealAnswers;
    const receipt: SubmissionReceipt = {
      submissionId: s.id,
      score: showScore ? s.score : null,
      maxScore: showScore ? s.maxScore : null,
      durationSeconds: s.durationSeconds,
      submittedAt: s.submittedAt,
      reason: s.reason,
    };
    if (quiz.revealAnswers) receipt.breakdown = grading.grade(quiz.questions, s.answers).breakdown;
    return receipt;
  };

  const loadAttempt = async (quiz: Quiz, attemptId: string): Promise<Attempt> => {
    const attempt = await repo.findAttempt(attemptId);
    if (attempt?.quizId !== quiz.id) throw notFound('Attempt not found');
    return attempt;
  };

  return {
    async submit({ quiz }, attemptId, { answers, reason }) {
      const attempt = await loadAttempt(quiz, attemptId);

      // Idempotent: a retried submit (network hiccup, double click) returns the stored result.
      const existing = await repo.findSubmissionByAttempt(attempt.id);
      if (existing) return toReceipt(quiz, existing);

      const submittedAt = nowIso();
      const expiresMs = new Date(attempt.expiresAt).getTime();
      const overrunSeconds = (new Date(submittedAt).getTime() - expiresMs) / 1000;
      // The server clock is authoritative: anything past the deadline is a timeout,
      // regardless of what the client claims. A small grace absorbs network latency.
      const effectiveReason: SubmissionReason = overrunSeconds > 0 ? 'timeout' : reason;
      if (overrunSeconds > SUBMISSION_GRACE_SECONDS) {
        logger.warn({ attemptId, overrunSeconds }, 'Late submission accepted as timeout');
      }

      const { score, maxScore } = grading.grade(quiz.questions, answers);
      const submission: Submission = {
        id: newId(),
        quizId: quiz.id,
        attemptId: attempt.id,
        examinee: attempt.examinee,
        answers,
        score,
        maxScore,
        durationSeconds: Math.min(secondsBetween(attempt.startedAt, submittedAt), quiz.durationSeconds),
        startedAt: attempt.startedAt,
        submittedAt,
        violations: attempt.violations,
        reason: effectiveReason,
      };

      await transaction(db, async (tx) => {
        const txRepo = createAttemptRepository(tx);
        await txRepo.insertSubmission(submission);
        await txRepo.markSubmitted(attempt.id);
      });
      events.emit('submission:created', submission);
      return toReceipt(quiz, submission);
    },

    async receipt({ quiz }, attemptId) {
      const attempt = await loadAttempt(quiz, attemptId);
      const submission = await repo.findSubmissionByAttempt(attempt.id);
      if (!submission) throw notFound('No submission for this attempt');
      return toReceipt(quiz, submission);
    },
  };
}
