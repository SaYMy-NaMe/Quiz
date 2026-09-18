import type { Quiz, QuizSettings, QuizSummary, SchemaField } from '@shared';
import type { QuizRepository } from './quiz.repository';
import type { QuizUpsertInput } from './quiz.schemas';
import { QuestionFactory } from './question.factory';
import { stateOf } from './quiz.state';
import { badRequest, conflict, notFound } from '@/utils/errors';
import { newId } from '@/utils/ids';
import { nowIso } from '@/utils/time';

export interface TokenIssuer {
  issueShareToken(): string;
}

export interface QuizService {
  list(ownerId: string): QuizSummary[];
  get(ownerId: string, quizId: string): Quiz;
  create(ownerId: string, input: QuizUpsertInput): Quiz;
  update(ownerId: string, quizId: string, input: QuizUpsertInput): Quiz;
  delete(ownerId: string, quizId: string): void;
  publish(ownerId: string, quizId: string): Quiz;
  unpublish(ownerId: string, quizId: string): Quiz;
  close(ownerId: string, quizId: string): Quiz;
  reopen(ownerId: string, quizId: string): Quiz;
  setLeaderboardVisibility(ownerId: string, quizId: string, visible: boolean): Quiz;
  /** Internal lookup used by share/attempt modules (no ownership check). */
  findByToken(token: string): Quiz | null;
  findById(quizId: string): Quiz | null;
}

interface Deps {
  repo: QuizRepository;
  tokens: TokenIssuer;
}

const DEFAULT_SETTINGS = {
  durationSeconds: 600,
  revealScores: true,
  revealAnswers: false,
  leaderboardVisible: true,
  accessMode: 'public' as const,
};

/** Merges a partial settings payload, ignoring undefined keys (exactOptionalPropertyTypes-safe). */
function applySettings(base: QuizSettings, partial: { [K in keyof QuizSettings]?: QuizSettings[K] | undefined }): QuizSettings {
  const next: QuizSettings = {
    durationSeconds: base.durationSeconds,
    revealScores: base.revealScores,
    revealAnswers: base.revealAnswers,
    leaderboardVisible: base.leaderboardVisible,
    accessMode: base.accessMode,
  };
  if (partial.durationSeconds !== undefined) next.durationSeconds = partial.durationSeconds;
  if (partial.revealScores !== undefined) next.revealScores = partial.revealScores;
  if (partial.revealAnswers !== undefined) next.revealAnswers = partial.revealAnswers;
  if (partial.leaderboardVisible !== undefined) next.leaderboardVisible = partial.leaderboardVisible;
  if (partial.accessMode !== undefined) next.accessMode = partial.accessMode;
  return next;
}

function buildExamineeFields(fields: QuizUpsertInput['examineeFields']): SchemaField[] {
  const ids = new Set<string>();
  return fields.map((f) => {
    if (ids.has(f.fieldId)) throw badRequest(`Duplicate examinee field id "${f.fieldId}"`);
    ids.add(f.fieldId);
    const field: SchemaField = { fieldId: f.fieldId, label: f.label, type: f.type, required: f.required };
    if (f.type === 'select' && f.options) field.options = f.options;
    if (f.placeholder) field.placeholder = f.placeholder;
    return field;
  });
}

export function createQuizService({ repo, tokens }: Deps): QuizService {
  const owned = (ownerId: string, quizId: string): Quiz => {
    const quiz = repo.findById(quizId);
    // Non-owners get the same 404 as a missing quiz so ids can't be probed.
    if (quiz?.ownerId !== ownerId) throw notFound('Quiz not found');
    return quiz;
  };

  const transition = (ownerId: string, quizId: string, fn: (quiz: Quiz) => Quiz): Quiz => {
    const next = { ...fn(owned(ownerId, quizId)), updatedAt: nowIso() };
    repo.update(next);
    return next;
  };

  return {
    list: (ownerId) => repo.listByOwner(ownerId),
    get: owned,
    findByToken: (token) => repo.findByToken(token),
    findById: (id) => repo.findById(id),

    create(ownerId, input) {
      const now = nowIso();
      const quiz: Quiz = {
        id: newId(),
        ownerId,
        title: input.title,
        description: input.description,
        status: 'draft',
        shareToken: null,
        ...applySettings(DEFAULT_SETTINGS, input.settings),
        examineeFields: buildExamineeFields(input.examineeFields),
        questions: QuestionFactory.createMany(input.questions),
        createdAt: now,
        updatedAt: now,
      };
      repo.insert(quiz);
      return quiz;
    },

    update(ownerId, quizId, input) {
      const quiz = owned(ownerId, quizId);
      if (!stateOf(quiz).editable) {
        throw conflict('Unpublish the quiz before editing its content');
      }
      const next: Quiz = {
        ...quiz,
        title: input.title,
        description: input.description,
        ...applySettings(quiz, input.settings),
        examineeFields: buildExamineeFields(input.examineeFields),
        questions: QuestionFactory.createMany(input.questions),
        updatedAt: nowIso(),
      };
      repo.update(next);
      return next;
    },

    delete(ownerId, quizId) {
      owned(ownerId, quizId);
      repo.delete(quizId);
    },

    publish: (o, id) => transition(o, id, (q) => stateOf(q).publish(q, () => tokens.issueShareToken())),
    unpublish: (o, id) => transition(o, id, (q) => stateOf(q).unpublish(q)),
    close: (o, id) => transition(o, id, (q) => stateOf(q).close(q)),
    reopen: (o, id) => transition(o, id, (q) => stateOf(q).reopen(q)),

    setLeaderboardVisibility: (o, id, visible) => transition(o, id, (q) => ({ ...q, leaderboardVisible: visible })),
  };
}
