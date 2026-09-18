import { api } from '@/utils/api';
import type { Quiz, QuizSummary, QuizUpsertPayload } from '@/types';

interface QuizResponse {
  quiz: Quiz;
}

export const quizApi = {
  list: () => api.get<{ quizzes: QuizSummary[] }>('/quizzes'),
  get: (id: string) => api.get<QuizResponse>(`/quizzes/${id}`),
  create: (payload: QuizUpsertPayload) => api.post<QuizResponse>('/quizzes', payload),
  update: (id: string, payload: QuizUpsertPayload) => api.put<QuizResponse>(`/quizzes/${id}`, payload),
  remove: (id: string) => api.delete<unknown>(`/quizzes/${id}`),
  publish: (id: string) => api.post<QuizResponse>(`/quizzes/${id}/publish`),
  unpublish: (id: string) => api.post<QuizResponse>(`/quizzes/${id}/unpublish`),
  close: (id: string) => api.post<QuizResponse>(`/quizzes/${id}/close`),
  reopen: (id: string) => api.post<QuizResponse>(`/quizzes/${id}/reopen`),
  rotateToken: (id: string) => api.post<QuizResponse>(`/quizzes/${id}/rotate-token`),
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.post<{ url: string }>('/uploads/image', form);
  },
};
