import { api } from '@/utils/api';
import type { Attempt, PublicQuestion, ExamineeRecord, AnswerMap, SubmissionReason, SubmissionReceipt, PublicQuiz } from '@/types';

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

const base = (token: string) => `/quizzes/v/${encodeURIComponent(token)}`;

/** Everything an examinee does, keyed by the share token — no authentication involved. */
export const examineeApi = {
  resolve: (token: string, signal?: AbortSignal) => api.get<{ quiz: PublicQuiz }>(base(token), signal ? { signal } : {}),
  validate: (token: string, examinee: ExamineeRecord) => api.post<{ examinee: ExamineeRecord }>(`${base(token)}/attempts/validate`, { examinee }),
  start: (token: string, examinee: ExamineeRecord) => api.post<StartedAttempt>(`${base(token)}/attempts`, { examinee }),
  resume: (token: string, attemptId: string) => api.get<StartedAttempt>(`${base(token)}/attempts/${attemptId}`),
  reportViolation: (token: string, attemptId: string, kind: string) => api.post<ViolationReport>(`${base(token)}/attempts/${attemptId}/violations`, { kind }),
  submit: (token: string, attemptId: string, answers: AnswerMap, reason: SubmissionReason) =>
    api.post<{ receipt: SubmissionReceipt }>(`${base(token)}/attempts/${attemptId}/submit`, { answers, reason }),
  result: (token: string, attemptId: string) => api.get<{ receipt: SubmissionReceipt }>(`${base(token)}/attempts/${attemptId}/result`),
};
