import type { Question, PublicQuestion } from './question';
import type { SchemaField } from './schema-field';

export type QuizStatus = 'draft' | 'published' | 'closed';
export type AccessMode = 'public' | 'restricted';

export interface QuizSettings {
  durationSeconds: number;
  /** Show the examinee their score on the result page. */
  revealScores: boolean;
  /** Show the examinee the answer key (implies the score is visible). */
  revealAnswers: boolean;
  leaderboardVisible: boolean;
  accessMode: AccessMode;
}

export interface Quiz extends QuizSettings {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  status: QuizStatus;
  /** Cryptographically random share token; null until first publish. */
  shareToken: string | null;
  examineeFields: SchemaField[];
  questions: Question[];
  createdAt: string;
  updatedAt: string;
}

/** Instructor-facing summary row. */
export interface QuizSummary {
  id: string;
  title: string;
  description: string;
  status: QuizStatus;
  accessMode: AccessMode;
  shareToken: string | null;
  questionCount: number;
  submissionCount: number;
  averageScore: number | null;
  maxScore: number;
  createdAt: string;
  updatedAt: string;
}

/** Quiz as exposed through a share link (answer keys stripped). */
export interface PublicQuiz {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
  leaderboardVisible: boolean;
  accessMode: AccessMode;
  examineeFields: SchemaField[];
  questionCount: number;
  /** Present only when the examinee is locked to an invite. */
  lockedEmail?: string;
}

export interface PublicQuizWithQuestions extends PublicQuiz {
  questions: PublicQuestion[];
}
