import { create } from 'zustand';
import { MAX_OPTIONS, MIN_OPTIONS } from '@shared';
import type { DraftQuestion, DraftSchemaField, Quiz, QuizDraft } from '../types';
import { DraftFactory, quizToDraft } from '../services/draft.mapper';

/**
 * Editor state is isolated from the examinee runtime store: the two lifecycles
 * (authoring vs. taking) never share mutable state.
 */
interface EditorState {
  draft: QuizDraft;
  quizId: string | null;
  status: Quiz['status'];
  dirty: boolean;
  load: (quiz: Quiz) => void;
  reset: () => void;
  setMeta: (patch: Partial<Pick<QuizDraft, 'title' | 'description'>>) => void;
  setSettings: (patch: Partial<QuizDraft['settings']>) => void;
  addQuestion: () => void;
  removeQuestion: (key: string) => void;
  moveQuestion: (key: string, direction: -1 | 1) => void;
  updateQuestion: (key: string, patch: Partial<Omit<DraftQuestion, 'key' | 'options'>>) => void;
  addOption: (questionKey: string) => void;
  removeOption: (questionKey: string, optionKey: string) => void;
  updateOption: (questionKey: string, optionKey: string, text: string) => void;
  setCorrect: (questionKey: string, optionKey: string) => void;
  addField: () => void;
  removeField: (key: string) => void;
  moveField: (key: string, direction: -1 | 1) => void;
  updateField: (key: string, patch: Partial<Omit<DraftSchemaField, 'key'>>) => void;
  markSaved: (quiz: Quiz) => void;
}

const move = <T extends { key: string }>(list: T[], key: string, dir: -1 | 1): T[] => {
  const i = list.findIndex((x) => x.key === key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
};

export const useEditorStore = create<EditorState>((set) => {
  const patchQuestion = (key: string, fn: (q: DraftQuestion) => DraftQuestion) =>
    set((s) => ({
      dirty: true,
      draft: { ...s.draft, questions: s.draft.questions.map((q) => (q.key === key ? fn(q) : q)) },
    }));

  return {
    draft: DraftFactory.quiz(),
    quizId: null,
    status: 'draft',
    dirty: false,

    load: (quiz) => set({ draft: quizToDraft(quiz), quizId: quiz.id, status: quiz.status, dirty: false }),
    reset: () => set({ draft: DraftFactory.quiz(), quizId: null, status: 'draft', dirty: false }),
    markSaved: (quiz) => set({ quizId: quiz.id, status: quiz.status, dirty: false }),

    setMeta: (patch) => set((s) => ({ dirty: true, draft: { ...s.draft, ...patch } })),
    setSettings: (patch) =>
      set((s) => ({ dirty: true, draft: { ...s.draft, settings: { ...s.draft.settings, ...patch } } })),

    addQuestion: () =>
      set((s) => ({ dirty: true, draft: { ...s.draft, questions: [...s.draft.questions, DraftFactory.question()] } })),
    removeQuestion: (key) =>
      set((s) => ({ dirty: true, draft: { ...s.draft, questions: s.draft.questions.filter((q) => q.key !== key) } })),
    moveQuestion: (key, dir) =>
      set((s) => ({ dirty: true, draft: { ...s.draft, questions: move(s.draft.questions, key, dir) } })),
    updateQuestion: (key, patch) => patchQuestion(key, (q) => ({ ...q, ...patch })),

    addOption: (qk) =>
      patchQuestion(qk, (q) => (q.options.length >= MAX_OPTIONS ? q : { ...q, options: [...q.options, DraftFactory.option()] })),
    removeOption: (qk, ok) =>
      patchQuestion(qk, (q) => {
        if (q.options.length <= MIN_OPTIONS) return q;
        const options = q.options.filter((o) => o.key !== ok);
        return { ...q, options, correctKey: q.correctKey === ok ? options[0]!.key : q.correctKey };
      }),
    updateOption: (qk, ok, text) =>
      patchQuestion(qk, (q) => ({ ...q, options: q.options.map((o) => (o.key === ok ? { ...o, text } : o)) })),
    setCorrect: (qk, ok) => patchQuestion(qk, (q) => ({ ...q, correctKey: ok })),

    addField: () =>
      set((s) => ({
        dirty: true,
        draft: { ...s.draft, examineeFields: [...s.draft.examineeFields, DraftFactory.schemaField()] },
      })),
    removeField: (key) =>
      set((s) => ({
        dirty: true,
        draft: { ...s.draft, examineeFields: s.draft.examineeFields.filter((f) => f.key !== key) },
      })),
    moveField: (key, dir) =>
      set((s) => ({ dirty: true, draft: { ...s.draft, examineeFields: move(s.draft.examineeFields, key, dir) } })),
    updateField: (key, patch) =>
      set((s) => ({
        dirty: true,
        draft: {
          ...s.draft,
          examineeFields: s.draft.examineeFields.map((f) => (f.key === key ? { ...f, ...patch } : f)),
        },
      })),
  };
});
