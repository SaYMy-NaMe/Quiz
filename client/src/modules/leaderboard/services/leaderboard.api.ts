import { api } from '@/utils/api';
import type { Leaderboard } from '@shared';

export type { Leaderboard, LeaderboardEntry } from '@shared';

export const leaderboardApi = {
  forQuiz: (quizId: string) => api.get<{ leaderboard: Leaderboard }>(`/quizzes/${quizId}/leaderboard`),
  forShare: (token: string, invite?: string | null, signal?: AbortSignal) =>
    api.get<{ leaderboard: Leaderboard }>(
      `/share/${encodeURIComponent(token)}/leaderboard${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`,
      signal ? { signal } : {},
    ),
};
