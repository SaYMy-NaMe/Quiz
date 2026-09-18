import { api } from '@/utils/api';
import type { ViolationKind } from './proctor';

export interface ViolationReport {
  violations: number;
  threshold: number;
  shouldSubmit: boolean;
}

export const proctorApi = {
  report: (token: string, attemptId: string, kind: ViolationKind, inviteToken?: string | null) =>
    api.post<ViolationReport>(`/share/${encodeURIComponent(token)}/attempts/${attemptId}/violations`, {
      kind,
      ...(inviteToken ? { inviteToken } : {}),
    }),
};
