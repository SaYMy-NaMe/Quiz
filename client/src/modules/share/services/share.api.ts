import { http } from '@/services/http';
import type { PublicQuiz } from '@/modules/quiz/types';

export interface Invite {
  id: string;
  quizId: string;
  email: string;
  token: string;
  createdAt: string;
}

export const shareApi = {
  resolve: (token: string, invite?: string | null, signal?: AbortSignal) =>
    http.get<{ quiz: PublicQuiz }>(`/share/${encodeURIComponent(token)}${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`, signal ? { signal } : {}),
  listInvites: (quizId: string) => http.get<{ invites: Invite[] }>(`/quizzes/${quizId}/invites`),
  addInvites: (quizId: string, emails: string[]) => http.post<{ invites: Invite[] }>(`/quizzes/${quizId}/invites`, { emails }),
  removeInvite: (quizId: string, inviteId: string) => http.delete<void>(`/quizzes/${quizId}/invites/${inviteId}`),
};
