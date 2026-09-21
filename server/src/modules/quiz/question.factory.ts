import { Types } from 'mongoose';
import { MIN_MCQ_OPTIONS } from '@shared';
import type { QuestionInput } from './quiz.schemas';
import { badRequest } from '@/utils/errors';
import { isObjectId } from './quiz.model';

/** Shape stored inside the quiz document (ObjectIds, not strings). */
export interface QuestionDocInput {
  _id: Types.ObjectId;
  type: QuestionInput['type'];
  prompt: string;
  promptType: QuestionInput['promptType'];
  imageUrl?: string;
  required: boolean;
  points: number;
  options: { _id: Types.ObjectId; text: string; imageUrl?: string }[];
  correctOptionId?: Types.ObjectId;
  acceptedAnswers: string[];
}

const oid = (id: string | undefined): Types.ObjectId => (id && isObjectId(id) ? new Types.ObjectId(id) : new Types.ObjectId());

/**
 * Factory: turns validated author input into embedded question sub-documents and enforces
 * the invariants zod cannot express (answer key references a real option, prompts present).
 * Existing ids are preserved so answers/analytics keyed by question id survive edits.
 */
export function buildQuestion(input: QuestionInput): QuestionDocInput {
  const prompt = input.prompt.trim();
  if (input.promptType === 'text' && !prompt) throw badRequest('Question prompt cannot be empty');
  if (input.promptType === 'image' && !input.imageUrl) throw badRequest('Image questions require an image');

  const base: QuestionDocInput = {
    _id: oid(input.id),
    type: input.type,
    prompt,
    promptType: input.promptType,
    required: input.required,
    points: input.points,
    options: [],
    acceptedAnswers: [],
  };
  if (input.promptType === 'image' && input.imageUrl) base.imageUrl = input.imageUrl;

  if (input.type === 'mcq') {
    if (input.options.length < MIN_MCQ_OPTIONS) throw badRequest(`MCQs need at least ${MIN_MCQ_OPTIONS} options`);
    base.options = input.options.map((o) => ({ _id: oid(o.id), text: o.text.trim(), ...(o.imageUrl ? { imageUrl: o.imageUrl } : {}) }));
    const correct =
      input.correctIndex !== undefined ? base.options[input.correctIndex] : base.options.find((o) => o._id.toString() === input.correctOptionId);
    if (!correct) throw badRequest('A correct answer must be designated for every MCQ');
    base.correctOptionId = correct._id;
  } else if (input.type === 'short') {
    base.acceptedAnswers = [...new Set(input.acceptedAnswers.map((a) => a.trim()).filter(Boolean))];
  }
  return base;
}

export function buildQuestions(inputs: QuestionInput[]): QuestionDocInput[] {
  const questions = inputs.map(buildQuestion);
  if (new Set(questions.map((q) => q._id.toString())).size !== questions.length) throw badRequest('Question ids must be unique');
  return questions;
}
