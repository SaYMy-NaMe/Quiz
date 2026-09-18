import { nextKey } from '@/utils/keys';
import type { DraftOption, DraftQuestion, DraftSchemaField, Quiz, QuizDraft, QuizUpsertPayload } from '../types';

/** Factory for blank editor entities (mirrors the server-side QuestionFactory). */
export const DraftFactory = {
  option(text = ''): DraftOption {
    return { key: nextKey('opt'), text };
  },
  question(): DraftQuestion {
    const options = [DraftFactory.option(), DraftFactory.option()];
    return {
      key: nextKey('q'),
      prompt: '',
      promptType: 'text',
      imageUrl: null,
      options,
      correctKey: options[0]!.key,
      points: 1,
    };
  },
  schemaField(): DraftSchemaField {
    return { key: nextKey('f'), fieldId: '', label: '', type: 'text', required: true, options: [], placeholder: '' };
  },
  quiz(): QuizDraft {
    return {
      title: '',
      description: '',
      settings: { durationSeconds: 600, revealAnswers: false, leaderboardVisible: true, accessMode: 'public' },
      examineeFields: [],
      questions: [DraftFactory.question()],
    };
  },
};

export function quizToDraft(quiz: Quiz): QuizDraft {
  return {
    title: quiz.title,
    description: quiz.description,
    settings: {
      durationSeconds: quiz.durationSeconds,
      revealAnswers: quiz.revealAnswers,
      leaderboardVisible: quiz.leaderboardVisible,
      accessMode: quiz.accessMode,
    },
    examineeFields: quiz.examineeFields.map((f) => ({
      key: nextKey('f'),
      fieldId: f.fieldId,
      label: f.label,
      type: f.type,
      required: f.required,
      options: f.options ?? [],
      placeholder: f.placeholder ?? '',
    })),
    questions: quiz.questions.map((q) => {
      const options = q.options.map((o) => ({ key: nextKey('opt'), id: o.id, text: o.text }));
      const correct = options.find((o) => o.id === q.correctOptionId) ?? options[0]!;
      return {
        key: nextKey('q'),
        id: q.id,
        prompt: q.prompt,
        promptType: q.promptType,
        imageUrl: q.imageUrl ?? null,
        options,
        correctKey: correct.key,
        points: q.points,
      };
    }),
  };
}

export function draftToPayload(draft: QuizDraft): QuizUpsertPayload {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    settings: draft.settings,
    examineeFields: draft.examineeFields.map((f) => ({
      fieldId: f.fieldId.trim(),
      label: f.label.trim(),
      type: f.type,
      required: f.required,
      ...(f.type === 'select' ? { options: f.options.map((o) => o.trim()).filter(Boolean) } : {}),
      ...(f.placeholder.trim() ? { placeholder: f.placeholder.trim() } : {}),
    })),
    questions: draft.questions.map((q) => ({
      ...(q.id ? { id: q.id } : {}),
      prompt: q.prompt,
      promptType: q.promptType,
      imageUrl: q.promptType === 'image' ? q.imageUrl : null,
      options: q.options.map((o) => ({ ...(o.id ? { id: o.id } : {}), text: o.text })),
      correctIndex: Math.max(
        0,
        q.options.findIndex((o) => o.key === q.correctKey),
      ),
      points: q.points,
    })),
  };
}
