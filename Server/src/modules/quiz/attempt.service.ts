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
  /** Step 1: validates examinee metadata against the dynamic schema without opening an attempt. */
  validateExaminee(share: ResolvedShare, examineeInput: unknown): ExamineeRecord;
  /** Step 1 → 2: validates examinee metadata and opens a timed attempt. */
  start(share: ResolvedShare, examineeInput: unknown): Promise<StartedAttempt>;
  /** Used on page refresh to re-sync the timer against the server clock. */
  resume(share: ResolvedShare, attemptId: string): Promise<StartedAttempt>;
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

  const validate = (quiz: Quiz, examineeInput: unknown, lockedEmail: string | undefined): ExamineeRecord => {
    // Invite-locked emails are supplied by the server, so the examinee never has to (and cannot) provide them.
    const input = typeof examineeInput === 'object' && examineeInput !== null ? (examineeInput as Record<string, unknown>) : {};
    const result = validateExaminee(quiz.examineeFields, applyLockedEmail(quiz, input as ExamineeRecord, lockedEmail));
    if (!result.success || !result.data) throw badRequest('Please correct the highlighted fields', { fieldErrors: result.errors });
    return applyLockedEmail(quiz, result.data, lockedEmail);
  };

  return {
    validateExaminee: ({ quiz, lockedEmail }, examineeInput) => validate(quiz, examineeInput, lockedEmail),

    async start({ quiz, lockedEmail }, examineeInput) {
      const examinee = validate(quiz, examineeInput, lockedEmail);
      const startedAt = nowIso();
      const attempt: Attempt = {
        id: newId(),
        quizId: quiz.id,
        examinee,
        status: 'in_progress',
        startedAt,
        expiresAt: addSeconds(startedAt, quiz.durationSeconds),
        violations: 0,
      };
      await repo.insertAttempt(attempt);
      return view(quiz, attempt);
    },

    async resume({ quiz }, attemptId) {
      const attempt = await repo.findAttempt(attemptId);
      if (attempt?.quizId !== quiz.id) throw notFound('Attempt not found');
      return view(quiz, attempt);
    },
  };
}
