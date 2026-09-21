import { api } from '@/utils/api';
import type { QuizAnalytics, Submission } from '@shared';

export type { QuizAnalytics, QuestionAnalytics } from '@shared';

export const dashboardApi = {
  analytics: (quizId: string) => api.get<{ analytics: QuizAnalytics }>(`/quizzes/${quizId}/analytics`),
  submissions: (quizId: string) => api.get<{ submissions: Submission[] }>(`/quizzes/${quizId}/submissions`),
  grade: (quizId: string, submissionId: string, grades: Record<string, number>) =>
    api.patch<{ submission: Submission }>(`/quizzes/${quizId}/submissions/${submissionId}/grade`, { grades }),
  regrade: (quizId: string) => api.post<{ result: { quizId: string; regraded: number; changed: number } }>(`/quizzes/${quizId}/regrade`),
};
