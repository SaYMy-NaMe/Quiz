import type { Quiz } from '@shared';
import type { AttemptRepository } from './attempt.repository';
import type { GradingStrategy } from './grading.strategy';
import type { QuizService } from './quiz.service';
import type { EventBus } from '@/services/event-bus';
import { transaction, type Db } from '@/services/database';

export interface RegradeResult {
  quizId: string;
  regraded: number;
  changed: number;
}

/**
 * Background evaluation engine. Grading normally happens at submit time; this
 * service re-runs the strategy over stored submissions when the instructor has
 * corrected an answer key (unpublish → edit → republish → regrade).
 */
export interface GradingService {
  regrade(ownerId: string, quizId: string): RegradeResult;
}

interface Deps {
  db: Db;
  quizzes: QuizService;
  repo: AttemptRepository;
  grading: GradingStrategy;
  events: EventBus;
}

export function createGradingService({ db, quizzes, repo, grading, events }: Deps): GradingService {
  return {
    regrade(ownerId, quizId) {
      const quiz: Quiz = quizzes.get(ownerId, quizId);
      const submissions = repo.listSubmissions(quiz.id);
      let changed = 0;
      transaction(db, () => {
        for (const s of submissions) {
          const { score, maxScore } = grading.grade(quiz.questions, s.answers);
          if (score !== s.score || maxScore !== s.maxScore) {
            repo.updateScore(s.id, score, maxScore);
            changed += 1;
          }
        }
      });
      if (changed > 0) events.emit('submissions:regraded', { quizId: quiz.id, changed });
      return { quizId: quiz.id, regraded: submissions.length, changed };
    },
  };
}
