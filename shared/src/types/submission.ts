import type { ExamineeRecord } from './schema-field';

export type AttemptStatus = 'in_progress' | 'submitted';
export type SubmissionReason = 'manual' | 'timeout' | 'violation';

/** Map of questionId -> chosen optionId. */
export type AnswerMap = Record<string, string>;

export interface Attempt {
  id: string;
  quizId: string;
  examinee: ExamineeRecord;
  status: AttemptStatus;
  startedAt: string;
  expiresAt: string;
  violations: number;
}

export interface Submission {
  id: string;
  quizId: string;
  attemptId: string;
  examinee: ExamineeRecord;
  answers: AnswerMap;
  score: number;
  maxScore: number;
  durationSeconds: number;
  startedAt: string;
  submittedAt: string;
  violations: number;
  reason: SubmissionReason;
}

export interface GradedQuestionResult {
  questionId: string;
  chosenOptionId: string | null;
  correctOptionId: string | null;
  correct: boolean;
  points: number;
  earned: number;
}

/** What the examinee sees after submitting. */
export interface SubmissionReceipt {
  submissionId: string;
  score: number;
  maxScore: number;
  durationSeconds: number;
  submittedAt: string;
  reason: SubmissionReason;
  /** Only populated when the quiz reveals answers. */
  breakdown?: GradedQuestionResult[];
}
