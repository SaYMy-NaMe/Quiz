import type { Attempt, ExamineeRecord, PublicQuestion, Quiz } from '@shared';
import { validateExaminee } from '@/modules/examinee';
import type { ResolvedShare } from '@/modules/share';
import type { AttemptRepository } from './attempt.repository';
import { badRequest, notFound } from '@/utils/errors';
import { newId } from '@/utils/ids';
import { nowIso, addSeconds } from '@/utils/time';

export interface StartedAttempt {
  attempt: Attempt;
  questions: PublicQuestion[];
  serverTime: string;
}

export interface AttemptService {
  /** Step 1 → 2: validates examinee metadata and opens a timed attempt. */
  start(share: ResolvedShare, examineeInput: unknown): StartedAttempt;
  /** Used on page refresh to re-sync the timer against the server clock. */
  resume(share: ResolvedShare, attemptId: string): StartedAttempt;
}

export const toPublicQuestions = (quiz: Quiz): PublicQuestion[] =>
  quiz.questions.map(({ correctOptionId: _omit, ...rest }) => rest);

/** Restricted links pin the examinee's email to the invite it was issued for. */
function applyLockedEmail(quiz: Quiz, record: ExamineeRecord, lockedEmail: string | undefined): ExamineeRecord {
  if (!lockedEmail) return record;
  const emailField = quiz.examineeFields.find((f) => f.type === 'email');
  return { ...record, [emailField?.fieldId ?? 'email']: lockedEmail };
}

export function createAttemptService(repo: AttemptRepository): AttemptService {
  const view = (quiz: Quiz, attempt: Attempt): StartedAttempt => ({
    attempt,
    questions: toPublicQuestions(quiz),
    serverTime: nowIso(),
  });

  return {
    start({ quiz, lockedEmail }, examineeInput) {
      const result = validateExaminee(quiz.examineeFields, examineeInput);
      if (!result.success || !result.data) throw badRequest('Please correct the highlighted fields', { fieldErrors: result.errors });
      const startedAt = nowIso();
      const attempt: Attempt = {
        id: newId(),
        quizId: quiz.id,
        examinee: applyLockedEmail(quiz, result.data, lockedEmail),
        status: 'in_progress',
        startedAt,
        expiresAt: addSeconds(startedAt, quiz.durationSeconds),
        violations: 0,
      };
      repo.insertAttempt(attempt);
      return view(quiz, attempt);
    },

    resume({ quiz }, attemptId) {
      const attempt = repo.findAttempt(attemptId);
      if (!attempt || attempt.quizId !== quiz.id) throw notFound('Attempt not found');
      return view(quiz, attempt);
    },
  };
}
