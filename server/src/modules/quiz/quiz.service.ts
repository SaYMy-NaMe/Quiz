import type { Quiz, QuizSummary } from '@shared';
import { QuizModel, toQuiz, toSummary, isObjectId, type QuizDoc } from './quiz.model';
import { SubmissionModel } from '@/modules/examinee/submission.model';
import { buildQuestions } from './question.factory';
import { transition, isEditable, type QuizAction } from './quiz.state';
import { generateShareToken } from '@/modules/share/token';
import type { QuizUpsertInput } from './quiz.schemas';
import { badRequest, conflict, notFound } from '@/utils/errors';

/** Loads a quiz the instructor owns; non-owners get the same 404 as a missing id. */
export async function ownedQuiz(ownerId: string, quizId: string): Promise<QuizDoc> {
  const doc = isObjectId(quizId) ? await QuizModel.findOne({ _id: quizId, owner: ownerId }) : null;
  if (!doc) throw notFound('Quiz not found');
  return doc;
}

function buildExamineeFields(fields: QuizUpsertInput['examineeFields']) {
  const ids = new Set<string>();
  return fields.map((f) => {
    if (ids.has(f.fieldId)) throw badRequest(`Duplicate examinee field id "${f.fieldId}"`);
    ids.add(f.fieldId);
    return f;
  });
}

export async function list(ownerId: string): Promise<QuizSummary[]> {
  const docs = await QuizModel.find({ owner: ownerId }).sort({ updatedAt: -1 });
  const stats = await SubmissionModel.aggregate<{ _id: unknown; count: number; average: number }>([
    { $match: { quiz: { $in: docs.map((d) => d._id) }, status: 'submitted' } },
    { $group: { _id: '$quiz', count: { $sum: 1 }, average: { $avg: '$score' } } },
  ]);
  const byQuiz = new Map(stats.map((s) => [String(s._id), s]));
  return docs.map((d) => {
    const s = byQuiz.get(d._id.toString());
    return toSummary(d, { count: s?.count ?? 0, average: s ? Math.round(s.average * 100) / 100 : null });
  });
}

export async function get(ownerId: string, quizId: string): Promise<Quiz> {
  return toQuiz(await ownedQuiz(ownerId, quizId));
}

export async function create(ownerId: string, input: QuizUpsertInput): Promise<Quiz> {
  const doc = await QuizModel.create({
    owner: ownerId,
    title: input.title,
    description: input.description,
    settings: input.settings,
    examineeFields: buildExamineeFields(input.examineeFields),
    questions: buildQuestions(input.questions),
  });
  return toQuiz(doc);
}

export async function update(ownerId: string, quizId: string, input: QuizUpsertInput): Promise<Quiz> {
  const doc = await ownedQuiz(ownerId, quizId);
  if (!isEditable(doc.status)) throw conflict('Unpublish the quiz before editing its content');
  doc.title = input.title;
  doc.description = input.description;
  doc.set('settings', { ...toQuiz(doc).settings, ...input.settings });
  doc.set('examineeFields', buildExamineeFields(input.examineeFields));
  doc.set('questions', buildQuestions(input.questions));
  await doc.save();
  return toQuiz(doc);
}

export async function remove(ownerId: string, quizId: string): Promise<void> {
  const doc = await ownedQuiz(ownerId, quizId);
  await Promise.all([SubmissionModel.deleteMany({ quiz: doc._id }), doc.deleteOne()]);
}

export async function applyAction(ownerId: string, quizId: string, action: QuizAction): Promise<Quiz> {
  const doc = await ownedQuiz(ownerId, quizId);
  if (action === 'publish' && doc.questions.length === 0) throw conflict('Add at least one question before publishing');
  doc.status = transition(doc.status, action);
  // First publish issues the token; later cycles keep it so shared links stay valid.
  if (action === 'publish' && !doc.shareToken) doc.shareToken = generateShareToken();
  await doc.save();
  return toQuiz(doc);
}

/** Issues a fresh share token; every previously distributed link stops resolving. */
export async function rotateShareToken(ownerId: string, quizId: string): Promise<Quiz> {
  const doc = await ownedQuiz(ownerId, quizId);
  if (!doc.shareToken) throw conflict('Publish the quiz before rotating its link');
  doc.shareToken = generateShareToken();
  await doc.save();
  return toQuiz(doc);
}
