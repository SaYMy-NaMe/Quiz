export type {
  Quiz,
  QuizSummary,
  QuizSettings,
  QuizStatus,
  Question,
  QuestionType,
  QuestionOption,
  PublicQuestion,
  PublicQuiz,
  PublicQuizWithQuestions,
  PromptType,
  SchemaField,
  SchemaFieldType,
  ExamineeRecord,
  Attempt,
  AnswerMap,
  Submission,
  SubmissionReceipt,
  SubmissionReason,
  GradedQuestionResult,
} from '@shared';

/** Client-side editor drafts carry a stable `key` before the server assigns ids. */
export interface DraftOption {
  key: string;
  id?: string;
  text: string;
  imageUrl: string | null;
}

export interface DraftQuestion {
  key: string;
  id?: string;
  type: 'mcq' | 'short' | 'long';
  prompt: string;
  promptType: 'text' | 'image';
  imageUrl: string | null;
  required: boolean;
  points: number;
  options: DraftOption[];
  correctKey: string;
  /** Short-answer keys, one per line in the editor. */
  acceptedAnswers: string;
}

export interface DraftSchemaField {
  key: string;
  fieldId: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'select';
  required: boolean;
  options: string[];
  placeholder: string;
}

export interface QuizDraft {
  title: string;
  description: string;
  settings: {
    durationSeconds: number;
    revealScores: boolean;
    revealAnswers: boolean;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
  };
  examineeFields: DraftSchemaField[];
  questions: DraftQuestion[];
}

/** Wire payload accepted by POST/PUT /api/quizzes. */
export interface QuizUpsertPayload {
  title: string;
  description: string;
  settings: QuizDraft['settings'];
  examineeFields: {
    fieldId: string;
    label: string;
    type: DraftSchemaField['type'];
    required: boolean;
    options?: string[];
    placeholder?: string;
  }[];
  questions: {
    id?: string;
    type: DraftQuestion['type'];
    prompt: string;
    promptType: 'text' | 'image';
    imageUrl?: string | null;
    required: boolean;
    points: number;
    options: { id?: string; text: string; imageUrl?: string | null }[];
    correctIndex?: number;
    acceptedAnswers: string[];
  }[];
}
