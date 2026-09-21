import type { AnswerMap, GradedQuestionResult, Question } from '@shared';

export interface GradeResult {
  score: number;
  maxScore: number;
  needsReview: boolean;
  breakdown: GradedQuestionResult[];
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Server-side evaluation. MCQs and keyed short answers are auto-graded; long answers (and
 * short answers without keys) earn the instructor's manual score, or nothing until reviewed.
 */
export function grade(questions: Question[], answers: AnswerMap, manualScores: Record<string, number> = {}): GradeResult {
  let score = 0;
  let maxScore = 0;
  let needsReview = false;

  const breakdown = questions.map<GradedQuestionResult>((q) => {
    maxScore += q.points;
    const raw = answers[q.id];
    const answer = raw !== undefined && raw !== '' ? raw : null;
    const base = { questionId: q.id, answer, correctOptionId: null, acceptedAnswers: null, points: q.points, needsReview: false };

    if (q.type === 'mcq') {
      const valid = answer !== null && q.options.some((o) => o.id === answer);
      const correct = valid && answer === q.correctOptionId;
      const earned = correct ? q.points : 0;
      score += earned;
      return { ...base, answer: valid ? answer : null, correctOptionId: q.correctOptionId ?? null, correct, earned };
    }

    const keyed = q.type === 'short' && (q.acceptedAnswers?.length ?? 0) > 0;
    if (keyed) {
      const correct = answer !== null && q.acceptedAnswers!.some((a) => normalize(a) === normalize(answer));
      const earned = correct ? q.points : 0;
      score += earned;
      return { ...base, acceptedAnswers: q.acceptedAnswers!, correct, earned };
    }

    // Manually graded text answer.
    const manual = manualScores[q.id];
    if (manual !== undefined) {
      const earned = Math.min(q.points, Math.max(0, manual));
      score += earned;
      return { ...base, correct: earned >= q.points, earned };
    }
    const pending = answer !== null;
    if (pending) needsReview = true;
    return { ...base, correct: false, earned: 0, needsReview: pending };
  });

  return { score: round(score), maxScore: round(maxScore), needsReview, breakdown };
}
