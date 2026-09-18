import { http } from '@/services/http';
import type { Attempt, PublicQuestion, ExamineeRecord } from '@/modules/quiz/types';

export interface StartedAttempt {
  attempt: Attempt;
  questions: PublicQuestion[];
  serverTime: string;
}

const base = (token: string) => `/share/${encodeURIComponent(token)}/attempts`;

export const attemptApi = {
  start: (token: string, examinee: ExamineeRecord, inviteToken?: string | null) =>
    http.post<StartedAttempt>(base(token), { examinee, ...(inviteToken ? { inviteToken } : {}) }),
  resume: (token: string, attemptId: string, inviteToken?: string | null) =>
    http.get<StartedAttempt>(`${base(token)}/${attemptId}${inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : ''}`),
};
