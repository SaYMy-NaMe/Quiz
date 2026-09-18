import type { QuizDraft } from '../types';

export interface DraftErrors {
  form: Record<string, string>;
  questions: Record<string, Record<string, string>>;
  fields: Record<string, Record<string, string>>;
}

const FIELD_ID = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/** Mirrors server-side validation so instructors get inline feedback before a round-trip. */
export function validateDraft(draft: QuizDraft): DraftErrors {
  const errors: DraftErrors = { form: {}, questions: {}, fields: {} };
  if (!draft.title.trim()) errors.form.title = 'Title is required';
  if (draft.settings.durationSeconds < 30) errors.form.durationSeconds = 'Minimum duration is 30 seconds';
  if (draft.questions.length === 0) errors.form.questions = 'Add at least one question';

  for (const q of draft.questions) {
    const e: Record<string, string> = {};
    if (q.promptType === 'text' && !q.prompt.trim()) e.prompt = 'Prompt is required';
    if (q.promptType === 'image' && !q.imageUrl) e.imageUrl = 'Upload an image for this question';
    q.options.forEach((o, i) => {
      if (!o.text.trim()) e[`options.${i}`] = 'Empty option';
    });
    if (Object.keys(e).some((k) => k.startsWith('options.'))) e.options = 'All options need text';
    if (!q.options.some((o) => o.key === q.correctKey)) e.options = 'Select the correct answer';
    if (Object.keys(e).length) errors.questions[q.key] = e;
  }

  const seen = new Set<string>();
  for (const f of draft.examineeFields) {
    const e: Record<string, string> = {};
    const id = f.fieldId.trim();
    if (!id) e.fieldId = 'Field id is required';
    else if (!FIELD_ID.test(id)) e.fieldId = 'Letters, numbers and underscores only';
    else if (seen.has(id)) e.fieldId = 'Duplicate field id';
    seen.add(id);
    if (!f.label.trim()) e.label = 'Label is required';
    if (f.type === 'select' && f.options.filter((o) => o.trim()).length === 0) e.options = 'Add at least one choice';
    if (Object.keys(e).length) errors.fields[f.key] = e;
  }
  return errors;
}

export const hasErrors = (e: DraftErrors): boolean =>
  Object.keys(e.form).length > 0 || Object.keys(e.questions).length > 0 || Object.keys(e.fields).length > 0;
