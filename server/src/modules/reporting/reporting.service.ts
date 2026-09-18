import type { Writable } from 'node:stream';
import type { AttemptRepository, QuizService } from '@/modules/quiz';
import type { LeaderboardService } from '@/modules/leaderboard';
import { writeSubmissionsWorkbook } from './excel.exporter';
import { computeAnalytics } from '@/modules/dashboard';
import { safeFilename } from './timestamp';

export interface PreparedExport {
  filename: string;
  /** Streams the workbook into `out`. Nothing is read from the DB until this is called. */
  write(out: Writable): Promise<void>;
}

export interface ReportingService {
  /** Resolves ownership up-front (404 before any bytes are sent), then returns a streaming writer. */
  prepareSubmissionsExport(ownerId: string, quizId: string): Promise<PreparedExport>;
}

interface Deps {
  quizzes: QuizService;
  attempts: AttemptRepository;
  leaderboard: LeaderboardService;
}

export function createReportingService({ quizzes, attempts, leaderboard }: Deps): ReportingService {
  return {
    async prepareSubmissionsExport(ownerId, quizId) {
      const quiz = await quizzes.get(ownerId, quizId);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      return {
        filename: `${safeFilename(quiz.title)}-submissions-${stamp}.xlsx`,
        async write(out) {
          const submissions = await attempts.listSubmissions(quiz.id);
          const board = leaderboard.rank(quiz, submissions);
          await writeSubmissionsWorkbook(out, { quiz, submissions, leaderboard: board, analytics: computeAnalytics(quiz, submissions) });
        },
      };
    },
  };
}
