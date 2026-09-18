import type { SubmissionReason } from './submission';

export interface QuestionAnalytics {
  questionId: string;
  prompt: string;
  points: number;
  answered: number;
  correct: number;
  /** 0..1 share of submissions that answered correctly. */
  correctRate: number;
  /** optionId -> number of examinees who chose it. */
  distribution: Record<string, number>;
}

export interface QuizAnalytics {
  quizId: string;
  submissionCount: number;
  averageScore: number | null;
  averagePercent: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  averageDurationSeconds: number | null;
  maxScore: number;
  reasons: Record<SubmissionReason, number>;
  totalViolations: number;
  questions: QuestionAnalytics[];
}
