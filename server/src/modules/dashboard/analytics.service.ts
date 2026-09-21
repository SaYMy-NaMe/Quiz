import type { Quiz, QuizAnalytics, Submission } from '@shared';
import { grade } from '@/modules/examinee/grading';

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
  // Per-question correctness reuses the grading engine so analytics and scores never disagree.
  const graded = submissions.map((s) => grade(quiz.questions, s.answers, s.manualScores).breakdown);

  return {
    quizId: quiz.id,
    submissionCount: submissions.length,
    pendingReview: submissions.filter((s) => s.needsReview).length,
    averageScore: avg(scores),
    averagePercent: maxScore > 0 && scores.length ? round((scores.reduce((a, b) => a + b, 0) / scores.length / maxScore) * 100) : null,
    highestScore: scores.length ? Math.max(...scores) : null,
    lowestScore: scores.length ? Math.min(...scores) : null,
    averageDurationSeconds: submissions.length ? Math.round(submissions.reduce((a, s) => a + s.durationSeconds, 0) / submissions.length) : null,
    maxScore,
    reasons,
    totalViolations,
    questions: quiz.questions.map((q, qi) => {
      const distribution: Record<string, number> = Object.fromEntries(q.options.map((o) => [o.id, 0]));
      let answered = 0;
      let correct = 0;
      for (const b of graded) {
        const r = b[qi];
        if (r?.answer === null || r === undefined) continue;
        answered += 1;
        if (r.correct) correct += 1;
        if (q.type === 'mcq' && r.answer in distribution) distribution[r.answer] = (distribution[r.answer] ?? 0) + 1;
      }
      return {
        questionId: q.id,
        type: q.type,
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
