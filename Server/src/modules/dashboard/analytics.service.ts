import type { Quiz, QuizAnalytics, Submission } from '@shared';
import type { AttemptRepository, QuizService } from '@/modules/quiz';

export interface AnalyticsService {
  forQuiz(ownerId: string, quizId: string): Promise<QuizAnalytics>;
  listSubmissions(ownerId: string, quizId: string): Promise<Submission[]>;
}

const round = (n: number) => Math.round(n * 100) / 100;
const avg = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function computeAnalytics(quiz: Quiz, submissions: Submission[]): QuizAnalytics {
  const maxScore = quiz.questions.reduce((s, q) => s + q.points, 0);
  const scores = submissions.map((s) => s.score);
  const reasons = { manual: 0, timeout: 0, violation: 0 };
  let totalViolations = 0;
  for (const s of submissions) {
    reasons[s.reason] += 1;
    totalViolations += s.violations;
  }
  return {
    quizId: quiz.id,
    submissionCount: submissions.length,
    averageScore: avg(scores),
    averagePercent: maxScore > 0 && scores.length ? round((scores.reduce((a, b) => a + b, 0) / scores.length / maxScore) * 100) : null,
    highestScore: scores.length ? Math.max(...scores) : null,
    lowestScore: scores.length ? Math.min(...scores) : null,
    averageDurationSeconds: submissions.length ? Math.round(submissions.reduce((a, s) => a + s.durationSeconds, 0) / submissions.length) : null,
    maxScore,
    reasons,
    totalViolations,
    questions: quiz.questions.map((q) => {
      const distribution: Record<string, number> = Object.fromEntries(q.options.map((o) => [o.id, 0]));
      let answered = 0;
      let correct = 0;
      for (const s of submissions) {
        const chosen = s.answers[q.id];
        if (!chosen || !(chosen in distribution)) continue;
        answered += 1;
        distribution[chosen] = (distribution[chosen] ?? 0) + 1;
        if (chosen === q.correctOptionId) correct += 1;
      }
      return {
        questionId: q.id,
        prompt: q.prompt || '[image question]',
        points: q.points,
        answered,
        correct,
        correctRate: submissions.length ? round(correct / submissions.length) : 0,
        distribution,
      };
    }),
  };
}

export function createAnalyticsService(quizzes: QuizService, attempts: AttemptRepository): AnalyticsService {
  return {
    async forQuiz(ownerId, quizId) {
      const quiz = await quizzes.get(ownerId, quizId);
      return computeAnalytics(quiz, await attempts.listSubmissions(quiz.id));
    },
    async listSubmissions(ownerId, quizId) {
      const quiz = await quizzes.get(ownerId, quizId);
      return attempts.listSubmissions(quiz.id);
    },
  };
}
