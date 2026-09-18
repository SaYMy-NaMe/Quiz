import type { Leaderboard, LeaderboardEntry, Quiz, Submission } from '@shared';
import { displayNameFor } from '@/modules/examinee';
import type { AttemptRepository, QuizService } from '@/modules/quiz';
import type { ResolvedShare } from '@/modules/share';
import type { EventBus } from '@/services/event-bus';
import type { RankingStrategy } from './ranking.strategy';
import { forbidden } from '@/utils/errors';
import { nowIso } from '@/utils/time';

export interface LeaderboardService {
  /** Instructor view — always allowed for the owner. */
  forInstructor(ownerId: string, quizId: string): Leaderboard;
  /** Examinee view — gated by the quiz's `leaderboardVisible` flag. */
  forExaminee(share: ResolvedShare): Leaderboard;
  /** Pure ranking used by both views and by the reporting module. */
  rank(quiz: Quiz, submissions: Submission[]): Leaderboard;
}

interface Deps {
  quizzes: QuizService;
  attempts: AttemptRepository;
  strategy: RankingStrategy;
  events: EventBus;
}

export function createLeaderboardService({ quizzes, attempts, strategy, events }: Deps): LeaderboardService {
  // Observer: a submission invalidates the cached board for its quiz so
  // examinee polling stays cheap while results stay real-time.
  const cache = new Map<string, Leaderboard>();
  events.on('submission:created', (s) => cache.delete(s.quizId));

  const rank = (quiz: Quiz, submissions: Submission[]): Leaderboard => {
    const sorted = [...submissions].sort((a, b) => strategy.compare(a, b));
    const entries: LeaderboardEntry[] = sorted.map((s, i) => ({
      rank: i + 1,
      submissionId: s.id,
      displayName: displayNameFor(quiz.examineeFields, s.examinee),
      examinee: s.examinee,
      score: s.score,
      maxScore: s.maxScore,
      durationSeconds: s.durationSeconds,
      submittedAt: s.submittedAt,
    }));
    return { quizId: quiz.id, title: quiz.title, generatedAt: nowIso(), entries };
  };

  const build = (quiz: Quiz): Leaderboard => {
    const cached = cache.get(quiz.id);
    if (cached) return cached;
    const board = rank(quiz, attempts.listSubmissions(quiz.id));
    cache.set(quiz.id, board);
    return board;
  };

  return {
    rank,
    forInstructor(ownerId, quizId) {
      return build(quizzes.get(ownerId, quizId));
    },
    forExaminee({ quiz }) {
      if (!quiz.leaderboardVisible) throw forbidden('The leaderboard is not visible for this quiz');
      const board = build(quiz);
      // Examinees never receive the raw metadata of other examinees.
      return { ...board, entries: board.entries.map((e) => ({ ...e, examinee: {} })) };
    },
  };
}
