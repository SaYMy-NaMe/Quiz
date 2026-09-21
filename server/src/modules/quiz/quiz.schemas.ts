import { z } from 'zod';
import { MIN_DURATION_SECONDS, MAX_DURATION_SECONDS, MIN_MCQ_OPTIONS } from '@shared';

export const OptionInputSchema = z
  .object({
    id: z.string().max(32).optional(),
    text: z.string().trim().max(500).default(''),
    imageUrl: z.string().max(500).nullable().optional(),
  })
  .refine((o) => o.text.length > 0 || Boolean(o.imageUrl), { message: 'Option needs text or an image', path: ['text'] });

export const QuestionInputSchema = z
  .object({
    id: z.string().max(32).optional(),
    type: z.enum(['mcq', 'short', 'long']).default('mcq'),
    prompt: z.string().trim().max(2000).default(''),
    promptType: z.enum(['text', 'image']).default('text'),
    imageUrl: z.string().max(500).nullable().optional(),
    required: z.boolean().default(true),
    points: z.number().min(0).max(1000).default(1),
    options: z.array(OptionInputSchema).default([]),
    /** Index into `options` (clients without ids) or an option id. */
    correctOptionId: z.string().optional(),
    correctIndex: z.number().int().min(0).optional(),
    acceptedAnswers: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  })
  .superRefine((q, ctx) => {
    if (q.type === 'mcq') {
      if (q.options.length < MIN_MCQ_OPTIONS) ctx.addIssue({ code: 'custom', path: ['options'], message: `MCQs need at least ${MIN_MCQ_OPTIONS} options` });
      if (q.correctOptionId === undefined && q.correctIndex === undefined) ctx.addIssue({ code: 'custom', path: ['correctIndex'], message: 'A correct answer must be designated' });
    }
  });

export const SchemaFieldInputSchema = z
  .object({
    fieldId: z.string().trim().min(1).max(40).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Field id must be alphanumeric/underscore and start with a letter'),
    label: z.string().trim().min(1).max(120),
    type: z.enum(['text', 'number', 'email', 'select']),
    required: z.boolean().default(true),
    options: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
    placeholder: z.string().trim().max(120).optional(),
  })
  .refine((f) => f.type !== 'select' || (f.options && f.options.length > 0), { message: 'Select fields need at least one option', path: ['options'] });

export const QuizSettingsSchema = z.object({
  durationSeconds: z.number().int().min(MIN_DURATION_SECONDS).max(MAX_DURATION_SECONDS),
  revealScores: z.boolean(),
  revealAnswers: z.boolean(),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
});

export const QuizUpsertSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000).default(''),
  settings: QuizSettingsSchema.partial().default({}),
  examineeFields: z.array(SchemaFieldInputSchema).max(30).default([]),
  questions: z.array(QuestionInputSchema).max(500).default([]),
});

export type QuizUpsertInput = z.infer<typeof QuizUpsertSchema>;
export type QuestionInput = z.infer<typeof QuestionInputSchema>;
