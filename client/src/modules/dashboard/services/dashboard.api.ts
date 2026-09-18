import { http } from '@/services/http';
import type { QuizAnalytics, Submission } from '@shared';

export type { QuizAnalytics, QuestionAnalytics } from '@shared';

export const dashboardApi = {
  analytics: (quizId: string) => http.get<{ analytics: QuizAnalytics }>(`/quizzes/${quizId}/analytics`),
  submissions: (quizId: string) => http.get<{ submissions: Submission[] }>(`/quizzes/${quizId}/submissions`),
  regrade: (quizId: string) => http.post<{ result: { quizId: string; regraded: number; changed: number } }>(`/quizzes/${quizId}/regrade`),
};
