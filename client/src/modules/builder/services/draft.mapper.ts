import { nextKey } from '@/utils/keys';
import type { DraftOption, DraftQuestion, DraftSchemaField, Quiz, QuizDraft, QuizUpsertPayload } from '@/types';

/** Factory for blank editor entities. */
export const DraftFactory = {
  option(text = ''): DraftOption {
    return { key: nextKey('opt'), text, imageUrl: null };
  },
  question(type: DraftQuestion['type'] = 'mcq'): DraftQuestion {
    const options = type === 'mcq' ? [DraftFactory.option(), DraftFactory.option()] : [];
    return { key: nextKey('q'), type, prompt: '', promptType: 'text', imageUrl: null, required: true, points: 1, options, correctKey: options[0]?.key ?? '', acceptedAnswers: '' };
  },
  schemaField(): DraftSchemaField {
    return { key: nextKey('f'), fieldId: '', label: '', type: 'text', required: true, options: [], placeholder: '' };
  },
  quiz(): QuizDraft {
    return {
      title: '',
      description: '',
      settings: { durationSeconds: 600, revealScores: true, revealAnswers: false, shuffleQuestions: false, shuffleOptions: false },
      examineeFields: [],
      questions: [DraftFactory.question()],
    };
  },
};

export function quizToDraft(quiz: Quiz): QuizDraft {
  return {
    title: quiz.title,
    description: quiz.description,
    settings: { ...quiz.settings },
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
      const options = q.options.map((o) => ({ key: nextKey('opt'), id: o.id, text: o.text, imageUrl: o.imageUrl ?? null }));
      const correct = options.find((o) => o.id === q.correctOptionId) ?? options[0];
      return {
        key: nextKey('q'),
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        promptType: q.promptType,
        imageUrl: q.imageUrl ?? null,
        required: q.required,
        points: q.points,
        options,
        correctKey: correct?.key ?? '',
        acceptedAnswers: (q.acceptedAnswers ?? []).join('\n'),
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
      type: q.type,
      prompt: q.prompt,
      promptType: q.promptType,
      imageUrl: q.promptType === 'image' ? q.imageUrl : null,
      required: q.required,
      points: q.points,
      options: q.type === 'mcq' ? q.options.map((o) => ({ ...(o.id ? { id: o.id } : {}), text: o.text.trim(), imageUrl: o.imageUrl })) : [],
      ...(q.type === 'mcq' ? { correctIndex: Math.max(0, q.options.findIndex((o) => o.key === q.correctKey)) } : {}),
      acceptedAnswers: q.type === 'short' ? q.acceptedAnswers.split('\n').map((a) => a.trim()).filter(Boolean) : [],
    })),
  };
}
