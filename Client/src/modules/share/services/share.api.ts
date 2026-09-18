import { api } from '@/utils/api';
import type { PublicQuiz } from '@/types';

export interface Invite {
  id: string;
  quizId: string;
  email: string;
  token: string;
  createdAt: string;
}

export const shareApi = {
  resolve: (token: string, invite?: string | null, signal?: AbortSignal) =>
    api.get<{ quiz: PublicQuiz }>(`/share/${encodeURIComponent(token)}${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`, signal ? { signal } : {}),
  listInvites: (quizId: string) => api.get<{ invites: Invite[] }>(`/quizzes/${quizId}/invites`),
  addInvites: (quizId: string, emails: string[]) => api.post<{ invites: Invite[] }>(`/quizzes/${quizId}/invites`, { emails }),
  removeInvite: (quizId: string, inviteId: string) => api.delete<unknown>(`/quizzes/${quizId}/invites/${inviteId}`),
};
