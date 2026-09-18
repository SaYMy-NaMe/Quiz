export type {
  Quiz,
  QuizSummary,
  QuizSettings,
  QuizStatus,
  AccessMode,
  Question,
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
}

export interface DraftQuestion {
  key: string;
  id?: string;
  prompt: string;
  promptType: 'text' | 'image';
  imageUrl: string | null;
  options: DraftOption[];
  correctKey: string;
  points: number;
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
    revealAnswers: boolean;
    leaderboardVisible: boolean;
    accessMode: 'public' | 'restricted';
  };
  examineeFields: DraftSchemaField[];
  questions: DraftQuestion[];
}

/** Wire payload accepted by POST/PUT /api/quizzes. */
export interface QuizUpsertPayload {
  title: string;
  description: string;
  settings: QuizDraft['settings'];
  examineeFields: Array<{
    fieldId: string;
    label: string;
    type: DraftSchemaField['type'];
    required: boolean;
    options?: string[];
    placeholder?: string;
  }>;
  questions: Array<{
    id?: string;
    prompt: string;
    promptType: 'text' | 'image';
    imageUrl?: string | null;
    options: Array<{ id?: string; text: string }>;
    correctIndex: number;
    points: number;
  }>;
}
