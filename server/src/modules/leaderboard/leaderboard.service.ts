import type { Leaderboard, Submission } from '@shared';
import { displayNameFor } from '@shared';
import type { QuizDoc } from '@/modules/quiz/quiz.model';
import { toQuiz } from '@/modules/quiz/quiz.model';

/** Score desc → Duration asc → SubmittedAt asc. */
export const compareRank = (a: Submission, b: Submission): number =>
  b.score - a.score || a.durationSeconds - b.durationSeconds || a.submittedAt.localeCompare(b.submittedAt);

/** Instructor-only ranking; examinees never see it. */
export function rank(quiz: QuizDoc, submissions: Submission[]): Leaderboard {
  const { examineeFields } = toQuiz(quiz);
  return {
    quizId: quiz._id.toString(),
    title: quiz.title,
    generatedAt: new Date().toISOString(),
    entries: [...submissions].sort(compareRank).map((s, i) => ({
      rank: i + 1,
      submissionId: s.id,
      displayName: displayNameFor(examineeFields, s.examinee),
      examinee: s.examinee,
      score: s.score,
      maxScore: s.maxScore,
      durationSeconds: s.durationSeconds,
      submittedAt: s.submittedAt,
    })),
  };
}
