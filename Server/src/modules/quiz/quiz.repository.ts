import type { Db } from '@/db/prisma';
import { parseJson } from '@/db/prisma';
import type { Quiz, QuizSummary, Question, SchemaField } from '@shared';
import type { Quiz as QuizRow } from '@prisma/client';

const toQuiz = (row: QuizRow): Quiz => ({
  id: row.id,
  ownerId: row.ownerId,
  title: row.title,
  description: row.description,
  status: row.status as Quiz['status'],
  accessMode: row.accessMode as Quiz['accessMode'],
  shareToken: row.shareToken,
  durationSeconds: row.durationSeconds,
  revealAnswers: row.revealAnswers,
  revealScores: row.revealScores,
  examineeFields: parseJson<SchemaField[]>(row.examineeFields, []),
  questions: parseJson<Question[]>(row.questions, []),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const toRow = (q: Quiz) => ({
  ownerId: q.ownerId,
  title: q.title,
  description: q.description,
  status: q.status,
  accessMode: q.accessMode,
  shareToken: q.shareToken,
  durationSeconds: q.durationSeconds,
  revealAnswers: q.revealAnswers,
  revealScores: q.revealScores,
  examineeFields: JSON.stringify(q.examineeFields),
  questions: JSON.stringify(q.questions),
  createdAt: new Date(q.createdAt),
  updatedAt: new Date(q.updatedAt),
});

export interface QuizRepository {
  listByOwner(ownerId: string): Promise<QuizSummary[]>;
  findById(id: string): Promise<Quiz | null>;
  findByToken(token: string): Promise<Quiz | null>;
  insert(quiz: Quiz): Promise<void>;
  update(quiz: Quiz): Promise<void>;
  delete(id: string): Promise<void>;
}

export function createQuizRepository(db: Db): QuizRepository {
  return {
    async listByOwner(ownerId) {
      const [rows, stats] = await Promise.all([
        db.quiz.findMany({ where: { ownerId }, orderBy: { updatedAt: 'desc' } }),
        db.submission.groupBy({ by: ['quizId'], where: { quiz: { ownerId } }, _count: { _all: true }, _avg: { score: true } }),
      ]);
      const byQuiz = new Map(stats.map((s) => [s.quizId, s]));
      return rows.map((row) => {
        const quiz = toQuiz(row);
        const stat = byQuiz.get(row.id);
        return {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          status: quiz.status,
          accessMode: quiz.accessMode,
          shareToken: quiz.shareToken,
          questionCount: quiz.questions.length,
          submissionCount: stat?._count._all ?? 0,
          averageScore: stat?._avg.score ?? null,
          maxScore: quiz.questions.reduce((sum, q) => sum + q.points, 0),
          createdAt: quiz.createdAt,
          updatedAt: quiz.updatedAt,
        };
      });
    },
    async findById(id) {
      const row = await db.quiz.findUnique({ where: { id } });
      return row ? toQuiz(row) : null;
    },
    async findByToken(token) {
      const row = await db.quiz.findUnique({ where: { shareToken: token } });
      return row ? toQuiz(row) : null;
    },
    async insert(q) {
      await db.quiz.create({ data: { id: q.id, ...toRow(q) } });
    },
    async update(q) {
      await db.quiz.update({ where: { id: q.id }, data: toRow(q) });
    },
    async delete(id) {
      await db.quiz.delete({ where: { id } });
    },
  };
}
