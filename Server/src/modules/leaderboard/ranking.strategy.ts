import type { Submission } from '@shared';

/**
 * Strategy Pattern for leaderboard ordering. A strategy is a comparator; the
 * ranking engine only knows how to sort and number rows.
 */
export interface RankingStrategy {
  readonly name: string;
  compare(a: Submission, b: Submission): number;
}

/** Score DESC → Duration ASC → SubmittedAt ASC (the platform default). */
export class ScoreDurationTimestampStrategy implements RankingStrategy {
  readonly name = 'score-duration-timestamp';
  compare(a: Submission, b: Submission): number {
    if (b.score !== a.score) return b.score - a.score;
    if (a.durationSeconds !== b.durationSeconds) return a.durationSeconds - b.durationSeconds;
    return a.submittedAt.localeCompare(b.submittedAt);
  }
}

/** Score DESC → SubmittedAt ASC (first to reach a score wins, ignoring pace). */
export class ScoreTimestampStrategy implements RankingStrategy {
  readonly name = 'score-timestamp';
  compare(a: Submission, b: Submission): number {
    if (b.score !== a.score) return b.score - a.score;
    return a.submittedAt.localeCompare(b.submittedAt);
  }
}
