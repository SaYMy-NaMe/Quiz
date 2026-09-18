import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editor.store';
import { draftToPayload, quizToDraft } from '../services/draft.mapper';
import { validateDraft, hasErrors } from '../services/draft.validator';
import type { Quiz } from '../types';

const state = () => useEditorStore.getState();

describe('editor store', () => {
  beforeEach(() => state().reset());

  it('enforces the 2–6 option window and keeps the answer key valid', () => {
    const q = state().draft.questions[0]!;
    expect(q.options).toHaveLength(2);
    state().removeOption(q.key, q.options[0]!.key);
    expect(state().draft.questions[0]!.options).toHaveLength(2);
    for (let i = 0; i < 6; i++) state().addOption(q.key);
    expect(state().draft.questions[0]!.options).toHaveLength(6);
    const correctKey = state().draft.questions[0]!.options[0]!.key;
    state().setCorrect(q.key, correctKey);
    state().removeOption(q.key, correctKey);
    const after = state().draft.questions[0]!;
    expect(after.options.some((o) => o.key === after.correctKey)).toBe(true);
    expect(state().dirty).toBe(true);
  });

  it('maps drafts to the wire payload with correctIndex and back from a quiz', () => {
    state().setMeta({ title: 'Mapped' });
    const q = state().draft.questions[0]!;
    state().updateOption(q.key, q.options[0]!.key, 'A');
    state().updateOption(q.key, q.options[1]!.key, 'B');
    state().updateQuestion(q.key, { prompt: 'Pick' });
    state().setCorrect(q.key, q.options[1]!.key);
    state().addField();
    const f = state().draft.examineeFields[0]!;
    state().updateField(f.key, { fieldId: 'section', label: 'Section', type: 'select', options: ['A', '', 'B'] });

    const payload = draftToPayload(state().draft);
    expect(payload.questions[0]).toMatchObject({ prompt: 'Pick', correctIndex: 1, options: [{ text: 'A' }, { text: 'B' }] });
    expect(payload.examineeFields[0]).toEqual({ fieldId: 'section', label: 'Section', type: 'select', required: true, options: ['A', 'B'] });

    const quiz: Quiz = {
      id: 'q', ownerId: 'o', title: 'Mapped', description: '', status: 'draft', shareToken: null, durationSeconds: 600,
      revealAnswers: false, leaderboardVisible: true, accessMode: 'public',
      examineeFields: [{ fieldId: 'section', label: 'Section', type: 'select', required: true, options: ['A', 'B'] }],
      questions: [{ id: 'q1', prompt: 'Pick', promptType: 'text', options: [{ id: 'o1', text: 'A' }, { id: 'o2', text: 'B' }], correctOptionId: 'o2', points: 1 }],
      createdAt: '', updatedAt: '',
    };
    const draft = quizToDraft(quiz);
    const dq = draft.questions[0]!;
    expect(dq.options.find((o) => o.key === dq.correctKey)?.id).toBe('o2');
  });

  it('validates drafts like the server does', () => {
    const errors = validateDraft(state().draft);
    expect(hasErrors(errors)).toBe(true);
    expect(errors.form.title).toBeTruthy();
    expect(errors.questions[state().draft.questions[0]!.key]?.prompt).toBeTruthy();
  });
});
