import { http } from '@/services/http';
import type { Leaderboard } from '@shared';

export type { Leaderboard, LeaderboardEntry } from '@shared';

export const leaderboardApi = {
  forQuiz: (quizId: string) => http.get<{ leaderboard: Leaderboard }>(`/quizzes/${quizId}/leaderboard`),
  forShare: (token: string, invite?: string | null, signal?: AbortSignal) =>
    http.get<{ leaderboard: Leaderboard }>(
      `/share/${encodeURIComponent(token)}/leaderboard${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`,
      signal ? { signal } : {},
    ),
};
