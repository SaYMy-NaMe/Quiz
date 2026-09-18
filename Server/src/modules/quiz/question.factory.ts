import type { Question, QuestionOption, PromptType } from '@shared';
import { MIN_OPTIONS, MAX_OPTIONS } from '@shared';
import { newId } from '@/utils/ids';
import { badRequest } from '@/utils/errors';

export interface OptionInput {
  id?: string | undefined;
  text: string;
  imageUrl?: string | null | undefined;
}

export interface QuestionInput {
  id?: string | undefined;
  prompt: string;
  promptType: PromptType;
  imageUrl?: string | null | undefined;
  options: OptionInput[];
  /** Index into `options` (preferred by clients that haven't got ids yet) or an option id. */
  correctOptionId?: string | undefined;
  correctIndex?: number | undefined;
  points?: number | undefined;
}

/**
 * Factory Pattern: centralises construction + invariants of questions and options
 * so ids are always assigned and the answer key always references a real option.
 */
export const OptionFactory = {
  create: (input: OptionInput): QuestionOption => {
    const text = input.text.trim();
    if (!text && !input.imageUrl) throw badRequest('Options need text or an image');
    const option: QuestionOption = { id: input.id ?? newId(), text };
    if (input.imageUrl) option.imageUrl = input.imageUrl;
    return option;
  },
};

export const QuestionFactory = {
  create: (input: QuestionInput): Question => {
    if (input.options.length < MIN_OPTIONS || input.options.length > MAX_OPTIONS) {
      throw badRequest(`Questions must have between ${MIN_OPTIONS} and ${MAX_OPTIONS} options`);
    }
    const options = input.options.map(OptionFactory.create);
    const ids = new Set(options.map((o) => o.id));
    if (ids.size !== options.length) throw badRequest('Option ids must be unique');

    let correctOptionId: string | undefined;
    if (typeof input.correctIndex === 'number') {
      correctOptionId = options[input.correctIndex]?.id;
    } else if (input.correctOptionId) {
      correctOptionId = options.find((o) => o.id === input.correctOptionId)?.id;
    }
    if (!correctOptionId) throw badRequest('A correct answer must be designated for every question');

    const prompt = input.prompt.trim();
    if (input.promptType === 'text' && !prompt) throw badRequest('Question prompt cannot be empty');
    if (input.promptType === 'image' && !input.imageUrl) throw badRequest('Image questions require an image');

    const question: Question = {
      id: input.id ?? newId(),
      prompt,
      promptType: input.promptType,
      options,
      correctOptionId,
      points: input.points && input.points > 0 ? input.points : 1,
    };
    if (input.promptType === 'image' && input.imageUrl) question.imageUrl = input.imageUrl;
    return question;
  },

  createMany: (inputs: QuestionInput[]): Question[] => {
    const questions = inputs.map((q) => QuestionFactory.create(q));
    const ids = new Set(questions.map((q) => q.id));
    if (ids.size !== questions.length) throw badRequest('Question ids must be unique');
    return questions;
  },
};
