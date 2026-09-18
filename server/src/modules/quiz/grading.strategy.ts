import type { AnswerMap, GradedQuestionResult, Question } from '@shared';

export interface GradeResult {
  score: number;
  maxScore: number;
  breakdown: GradedQuestionResult[];
}

/**
 * Strategy Pattern: grading policies are interchangeable. The default awards
 * full points per correct MCQ; alternative strategies (negative marking,
 * partial credit) plug in without touching the submission pipeline.
 */
export interface GradingStrategy {
  readonly name: string;
  grade(questions: Question[], answers: AnswerMap): GradeResult;
}

export class StandardGradingStrategy implements GradingStrategy {
  readonly name = 'standard';
  grade(questions: Question[], answers: AnswerMap): GradeResult {
    let score = 0;
    let maxScore = 0;
    const breakdown = questions.map<GradedQuestionResult>((q) => {
      const chosen = answers[q.id] ?? null;
      const valid = chosen !== null && q.options.some((o) => o.id === chosen);
      const correct = valid && chosen === q.correctOptionId;
      const earned = correct ? q.points : 0;
      score += earned;
      maxScore += q.points;
      return { questionId: q.id, chosenOptionId: valid ? chosen : null, correctOptionId: q.correctOptionId, correct, points: q.points, earned };
    });
    return { score: round(score), maxScore: round(maxScore), breakdown };
  }
}

/** Negative marking: wrong answers cost a fraction of the question's points; blanks cost nothing. */
export class NegativeMarkingStrategy implements GradingStrategy {
  readonly name = 'negative-marking';
  constructor(private readonly penaltyRatio = 0.25) {}
  grade(questions: Question[], answers: AnswerMap): GradeResult {
    const base = new StandardGradingStrategy().grade(questions, answers);
    let score = 0;
    const breakdown = base.breakdown.map((r) => {
      const earned = r.correct ? r.points : r.chosenOptionId ? -r.points * this.penaltyRatio : 0;
      score += earned;
      return { ...r, earned: round(earned) };
    });
    return { score: round(Math.max(0, score)), maxScore: base.maxScore, breakdown };
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
