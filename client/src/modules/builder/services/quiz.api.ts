import { http } from '@/services/http';
import type { Quiz, QuizSummary, QuizUpsertPayload } from '@/types';

interface QuizResponse {
  quiz: Quiz;
}

export const quizApi = {
  list: () => http.get<{ quizzes: QuizSummary[] }>('/quizzes'),
  get: (id: string) => http.get<QuizResponse>(`/quizzes/${id}`),
  create: (payload: QuizUpsertPayload) => http.post<QuizResponse>('/quizzes', payload),
  update: (id: string, payload: QuizUpsertPayload) => http.put<QuizResponse>(`/quizzes/${id}`, payload),
  remove: (id: string) => http.delete<unknown>(`/quizzes/${id}`),
  publish: (id: string) => http.post<QuizResponse>(`/quizzes/${id}/publish`),
  unpublish: (id: string) => http.post<QuizResponse>(`/quizzes/${id}/unpublish`),
  close: (id: string) => http.post<QuizResponse>(`/quizzes/${id}/close`),
  reopen: (id: string) => http.post<QuizResponse>(`/quizzes/${id}/reopen`),
  setLeaderboardVisibility: (id: string, visible: boolean) =>
    http.patch<QuizResponse>(`/quizzes/${id}/leaderboard-visibility`, { visible }),
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return http.post<{ url: string }>('/uploads/image', form);
  },
};
