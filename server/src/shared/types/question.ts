export type QuestionType = 'mcq' | 'short' | 'long';
export type PromptType = 'text' | 'image';

export interface QuestionOption {
  id: string;
  text: string;
  /** Optional image prompt for the choice itself. */
  imageUrl?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  promptType: PromptType;
  /** Set when `promptType === 'image'`. */
  imageUrl?: string;
  /** Whether the examinee must answer before a manual submit is accepted. */
  required: boolean;
  points: number;
  /** MCQ choices (any count ≥ 2); empty for text questions. */
  options: QuestionOption[];
  /** MCQ answer key. */
  correctOptionId?: string;
  /** Short-answer auto-grading keys (case/whitespace-insensitive). Empty ⇒ graded manually. */
  acceptedAnswers?: string[];
}

/** Question as exposed to an examinee (answer keys stripped). */
export type PublicQuestion = Omit<Question, 'correctOptionId' | 'acceptedAnswers'>;
