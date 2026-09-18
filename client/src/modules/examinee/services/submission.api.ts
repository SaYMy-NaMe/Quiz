import { http } from '@/services/http';
import type { AnswerMap, SubmissionReason, SubmissionReceipt } from '@/types';

const base = (token: string, attemptId: string) => `/share/${encodeURIComponent(token)}/attempts/${attemptId}`;

export const submissionApi = {
  submit: (token: string, attemptId: string, answers: AnswerMap, reason: SubmissionReason, inviteToken?: string | null) =>
    http.post<{ receipt: SubmissionReceipt }>(`${base(token, attemptId)}/submit`, { answers, reason, ...(inviteToken ? { inviteToken } : {}) }),
  result: (token: string, attemptId: string, inviteToken?: string | null) =>
    http.get<{ receipt: SubmissionReceipt }>(`${base(token, attemptId)}/result${inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : ''}`),
};
