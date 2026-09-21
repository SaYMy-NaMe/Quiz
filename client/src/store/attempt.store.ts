import { create } from 'zustand';
import { localStore } from '@/services/storage';
import type { AnswerMap, Attempt, ExamineeRecord, PublicQuestion, SubmissionReceipt } from '@/types';

/**
 * Runtime state of an examinee's attempt. Persisted to localStorage per share
 * token so a refresh restores the attempt id, answers and clock without
 * resetting the timer (the server clock is authoritative on resume).
 */
export interface PersistedAttempt {
  attemptId: string;
  quizId: string;
  startedAt: string;
  expiresAt: string;
  answers: AnswerMap;
  violations: number;
  receipt?: SubmissionReceipt;
}

interface AttemptState {
  token: string | null;
  attempt: Attempt | null;
  questions: PublicQuestion[];
  answers: AnswerMap;
  /** Milliseconds to add to Date.now() to approximate the server clock. */
  clockOffsetMs: number;
  receipt: SubmissionReceipt | null;
  hydrate: (token: string) => PersistedAttempt | null;
  /** Step 1 → 2 hand-off: validated metadata waiting for "Start Quiz". */
  setPendingExaminee: (token: string, quizId: string, examinee: ExamineeRecord) => void;
  getPendingExaminee: (token: string, quizId: string) => ExamineeRecord | null;
  clearPendingExaminee: (token: string) => void;
  begin: (token: string, attempt: Attempt, questions: PublicQuestion[], serverTime: string) => void;
  restore: (token: string, attempt: Attempt, questions: PublicQuestion[], serverTime: string, persisted: PersistedAttempt) => void;
  answer: (questionId: string, optionId: string) => void;
  setReceipt: (receipt: SubmissionReceipt) => void;
  /** Increments the local violation counter and returns the new value. */
  recordViolation: () => number;
  syncViolations: (count: number) => void;
  clear: (token: string) => void;
}

const key = (token: string) => `attempt:${token}`;
const pendingKey = (token: string) => `pending:${token}`;

interface PendingExaminee {
  quizId: string;
  examinee: ExamineeRecord;
}

export const useAttemptStore = create<AttemptState>((set, get) => {
  const persist = () => {
    const { token, attempt, answers, receipt } = get();
    if (!token || !attempt) return;
    const data: PersistedAttempt = {
      attemptId: attempt.id,
      quizId: attempt.quizId,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      answers,
      violations: attempt.violations,
      ...(receipt ? { receipt } : {}),
    };
    localStore.set(key(token), data);
  };

  return {
    token: null,
    attempt: null,
    questions: [],
    answers: {},
    clockOffsetMs: 0,
    receipt: null,

    hydrate: (token) => localStore.get<PersistedAttempt>(key(token)),

    setPendingExaminee: (token, quizId, examinee) => localStore.set<PendingExaminee>(pendingKey(token), { quizId, examinee }),
    getPendingExaminee: (token, quizId) => {
      const p = localStore.get<PendingExaminee>(pendingKey(token));
      return p?.quizId === quizId ? p.examinee : null;
    },
    clearPendingExaminee: (token) => localStore.remove(pendingKey(token)),

    begin(token, attempt, questions, serverTime) {
      set({ token, attempt, questions, answers: {}, receipt: null, clockOffsetMs: new Date(serverTime).getTime() - Date.now() });
      persist();
    },

    restore(token, attempt, questions, serverTime, persisted) {
      set({
        token,
        attempt: { ...attempt, violations: Math.max(attempt.violations, persisted.violations) },
        questions,
        answers: persisted.answers,
        receipt: persisted.receipt ?? null,
        clockOffsetMs: new Date(serverTime).getTime() - Date.now(),
      });
      persist();
    },

    answer(questionId, optionId) {
      set((s) => ({ answers: { ...s.answers, [questionId]: optionId } }));
      persist();
    },

    setReceipt(receipt) {
      set({ receipt });
      persist();
    },

    recordViolation() {
      const { attempt } = get();
      if (!attempt) return 0;
      const violations = attempt.violations + 1;
      set({ attempt: { ...attempt, violations } });
      persist();
      return violations;
    },

    syncViolations(count) {
      const { attempt } = get();
      if (!attempt || count <= attempt.violations) return;
      set({ attempt: { ...attempt, violations: count } });
      persist();
    },

    clear(token) {
      localStore.remove(key(token));
      localStore.remove(pendingKey(token));
      set({ token: null, attempt: null, questions: [], answers: {}, receipt: null });
    },
  };
});
