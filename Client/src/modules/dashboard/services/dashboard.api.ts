import { api } from '@/utils/api';
import type { QuizAnalytics, Submission } from '@shared';

export type { QuizAnalytics, QuestionAnalytics } from '@shared';

export const dashboardApi = {
  analytics: (quizId: string) => api.get<{ analytics: QuizAnalytics }>(`/quizzes/${quizId}/analytics`),
  submissions: (quizId: string) => api.get<{ submissions: Submission[] }>(`/quizzes/${quizId}/submissions`),
  regrade: (quizId: string) => api.post<{ result: { quizId: string; regraded: number; changed: number } }>(`/quizzes/${quizId}/regrade`),
};
