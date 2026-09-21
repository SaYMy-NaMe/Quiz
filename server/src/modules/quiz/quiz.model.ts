import { Schema, model, type HydratedDocumentFromSchema, type InferSchemaType, Types } from 'mongoose';
import type { Quiz, Question, QuizSummary } from '@shared';

/**
 * Quiz aggregate. Everything an instructor authors — settings, the Step-1 examinee form
 * schema, questions and their options — is embedded: it is always read and written together,
 * edits are atomic, and the public endpoint needs a single document read.
 * Submissions live in their own collection (unbounded growth, queried independently).
 */
const optionSchema = new Schema(
  {
    text: { type: String, default: '', maxlength: 500 },
    imageUrl: { type: String },
  },
  { _id: true },
);

const questionSchema = new Schema(
  {
    type: { type: String, enum: ['mcq', 'short', 'long'], required: true },
    prompt: { type: String, default: '', maxlength: 2000 },
    promptType: { type: String, enum: ['text', 'image'], default: 'text' },
    imageUrl: { type: String },
    required: { type: Boolean, default: true },
    points: { type: Number, default: 1, min: 0 },
    /** Any number of choices (≥ 2 enforced by the factory) — no hardcoded maximum. */
    options: { type: [optionSchema], default: [] },
    /** MCQ answer key: the _id of one of `options`. Never sent to examinees. */
    correctOptionId: { type: Schema.Types.ObjectId },
    /** Short-answer keys; empty ⇒ graded manually. Never sent to examinees. */
    acceptedAnswers: { type: [String], default: [] },
  },
  { _id: true },
);

const examineeFieldSchema = new Schema(
  {
    fieldId: { type: String, required: true, maxlength: 40 },
    label: { type: String, required: true, maxlength: 120 },
    type: { type: String, enum: ['text', 'number', 'email', 'select'], required: true },
    required: { type: Boolean, default: true },
    options: { type: [String], default: undefined },
    placeholder: { type: String },
  },
  { _id: false },
);

const settingsSchema = new Schema(
  {
    durationSeconds: { type: Number, default: 600, min: 30 },
    revealScores: { type: Boolean, default: true },
    revealAnswers: { type: Boolean, default: false },
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions: { type: Boolean, default: false },
  },
  { _id: false },
);

const quizSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 2000 },
    status: { type: String, enum: ['draft', 'published', 'closed'], default: 'draft' },
    /** Sparse unique: drafts have no token yet. */
    shareToken: { type: String, unique: true, sparse: true },
    settings: { type: settingsSchema, default: () => ({}) },
    examineeFields: { type: [examineeFieldSchema], default: [] },
    questions: { type: [questionSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

export type QuizSchema = InferSchemaType<typeof quizSchema>;
export type QuizDoc = HydratedDocumentFromSchema<typeof quizSchema>;
export const QuizModel = model('Quiz', quizSchema);

/** Document → API contract (ObjectIds become strings; `owner` becomes `ownerId`). */
export function toQuiz(doc: QuizDoc): Quiz {
  return {
    id: doc._id.toString(),
    ownerId: doc.owner.toString(),
    title: doc.title,
    description: doc.description,
    status: doc.status,
    shareToken: doc.shareToken ?? null,
    settings: {
      durationSeconds: doc.settings.durationSeconds,
      revealScores: doc.settings.revealScores,
      revealAnswers: doc.settings.revealAnswers,
      shuffleQuestions: doc.settings.shuffleQuestions,
      shuffleOptions: doc.settings.shuffleOptions,
    },
    examineeFields: doc.examineeFields.map((f) => ({
      fieldId: f.fieldId,
      label: f.label,
      type: f.type,
      required: f.required,
      ...(f.options ? { options: [...f.options] } : {}),
      ...(f.placeholder ? { placeholder: f.placeholder } : {}),
    })),
    questions: doc.questions.map(toQuestion),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toQuestion(q: QuizDoc['questions'][number]): Question {
  const question: Question = {
    id: q._id.toString(),
    type: q.type,
    prompt: q.prompt,
    promptType: q.promptType,
    required: q.required,
    points: q.points,
    options: q.options.map((o) => ({ id: o._id.toString(), text: o.text, ...(o.imageUrl ? { imageUrl: o.imageUrl } : {}) })),
  };
  if (q.imageUrl) question.imageUrl = q.imageUrl;
  if (q.correctOptionId) question.correctOptionId = q.correctOptionId.toString();
  if (q.acceptedAnswers.length) question.acceptedAnswers = [...q.acceptedAnswers];
  return question;
}

export const maxScoreOf = (questions: Pick<Question, 'points'>[]): number => questions.reduce((s, q) => s + q.points, 0);

export function toSummary(doc: QuizDoc, stats: { count: number; average: number | null }): QuizSummary {
  const quiz = toQuiz(doc);
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    status: quiz.status,
    shareToken: quiz.shareToken,
    questionCount: quiz.questions.length,
    submissionCount: stats.count,
    averageScore: stats.average,
    maxScore: maxScoreOf(quiz.questions),
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt,
  };
}

export const isObjectId = (v: string): boolean => Types.ObjectId.isValid(v) && String(new Types.ObjectId(v)) === v;
