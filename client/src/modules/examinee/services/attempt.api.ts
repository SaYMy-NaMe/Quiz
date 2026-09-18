import { api } from '@/utils/api';
import type { Attempt, PublicQuestion, ExamineeRecord } from '@/types';

export interface StartedAttempt {
  attempt: Attempt;
  questions: PublicQuestion[];
  serverTime: string;
}

const base = (token: string) => `/share/${encodeURIComponent(token)}/attempts`;

export const attemptApi = {
  /** Step 1: server-side validation of the metadata form; creates nothing. */
  validate: (token: string, examinee: ExamineeRecord, inviteToken?: string | null) =>
    api.post<{ examinee: ExamineeRecord }>(`${base(token)}/validate`, { examinee, ...(inviteToken ? { inviteToken } : {}) }),
  start: (token: string, examinee: ExamineeRecord, inviteToken?: string | null) =>
    api.post<StartedAttempt>(base(token), { examinee, ...(inviteToken ? { inviteToken } : {}) }),
  resume: (token: string, attemptId: string, inviteToken?: string | null) =>
    api.get<StartedAttempt>(`${base(token)}/${attemptId}${inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : ''}`),
};
