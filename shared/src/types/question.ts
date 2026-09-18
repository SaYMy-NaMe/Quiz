export type PromptType = 'text' | 'image';

export interface QuestionOption {
  id: string;
  text: string;
  /** Optional image prompt for the choice itself. */
  imageUrl?: string;
}

export interface Question {
  id: string;
  prompt: string;
  promptType: PromptType;
  /** Set when `promptType === 'image'`. */
  imageUrl?: string;
  options: QuestionOption[];
  correctOptionId: string;
  points: number;
}

/** Question as exposed to an examinee (no answer key). */
export type PublicQuestion = Omit<Question, 'correctOptionId'>;

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
