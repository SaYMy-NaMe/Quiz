import type { ExamineeRecord } from './schema-field';

export type AttemptStatus = 'in_progress' | 'submitted';
export type SubmissionReason = 'manual' | 'timeout' | 'violation';

/** Map of questionId -> answer: an optionId for MCQ, free text for short/long answers. */
export type AnswerMap = Record<string, string>;

/** Examinee-facing view of an in-progress attempt. */
export interface Attempt {
  id: string;
  quizId: string;
  examinee: ExamineeRecord;
  status: AttemptStatus;
  startedAt: string;
  expiresAt: string;
  violations: number;
}

export interface ViolationEvent {
  kind: string;
  at: string;
}

/** Instructor-facing submitted attempt. */
export interface Submission {
  id: string;
  quizId: string;
  examinee: ExamineeRecord;
  answers: AnswerMap;
  score: number;
  maxScore: number;
  /** True while any text question still awaits a manual grade. */
  needsReview: boolean;
  /** Instructor-assigned points for text questions, by questionId. */
  manualScores: Record<string, number>;
  durationSeconds: number;
  startedAt: string;
  submittedAt: string;
  violations: number;
  violationEvents: ViolationEvent[];
  reason: SubmissionReason;
}

export interface GradedQuestionResult {
  questionId: string;
  /** Option id (MCQ) or the text given (short/long). */
  answer: string | null;
  correctOptionId: string | null;
  acceptedAnswers: string[] | null;
  correct: boolean;
  /** True when the question is graded by hand and no grade has been given yet. */
  needsReview: boolean;
  points: number;
  earned: number;
}

/** What the examinee sees after submitting. */
export interface SubmissionReceipt {
  submissionId: string;
  /** Null when the instructor hides scores from examinees. */
  score: number | null;
  maxScore: number | null;
  needsReview: boolean;
  durationSeconds: number;
  submittedAt: string;
  reason: SubmissionReason;
  /** Only populated when the quiz reveals answers. */
  breakdown?: GradedQuestionResult[];
}
