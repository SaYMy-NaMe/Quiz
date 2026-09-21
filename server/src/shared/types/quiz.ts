import type { Question, PublicQuestion } from './question';
import type { SchemaField } from './schema-field';

export type QuizStatus = 'draft' | 'published' | 'closed';

export interface QuizSettings {
  durationSeconds: number;
  /** Show the examinee their score on the result page. */
  revealScores: boolean;
  /** Show the examinee the answer key (implies the score is visible). */
  revealAnswers: boolean;
  /** Randomise question order per attempt. */
  shuffleQuestions: boolean;
  /** Randomise MCQ option order per attempt. */
  shuffleOptions: boolean;
}

export interface Quiz {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  status: QuizStatus;
  /** Cryptographically random share token; null until first publish. */
  shareToken: string | null;
  settings: QuizSettings;
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
  shareToken: string | null;
  questionCount: number;
  submissionCount: number;
  averageScore: number | null;
  maxScore: number;
  createdAt: string;
  updatedAt: string;
}

/** Quiz as exposed through a share link (answer keys stripped, no questions yet). */
export interface PublicQuiz {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
  examineeFields: SchemaField[];
  questionCount: number;
}

export interface PublicQuizWithQuestions extends PublicQuiz {
  questions: PublicQuestion[];
}
