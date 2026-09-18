import type { Db } from '@/services/database';
import type { Quiz, QuizSummary, Question, SchemaField } from '@shared';
import { parseJson } from '@/utils/json';

interface QuizRow {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  status: Quiz['status'];
  access_mode: Quiz['accessMode'];
  share_token: string | null;
  duration_seconds: number;
  reveal_answers: number;
  reveal_scores: number;
  leaderboard_visible: number;
  examinee_fields: string;
  questions: string;
  created_at: string;
  updated_at: string;
}

interface SummaryRow extends QuizRow {
  submission_count: number;
  average_score: number | null;
}

const toQuiz = (row: QuizRow): Quiz => ({
  id: row.id,
  ownerId: row.owner_id,
  title: row.title,
  description: row.description,
  status: row.status,
  accessMode: row.access_mode,
  shareToken: row.share_token,
  durationSeconds: row.duration_seconds,
  revealAnswers: row.reveal_answers === 1,
  revealScores: row.reveal_scores === 1,
  leaderboardVisible: row.leaderboard_visible === 1,
  examineeFields: parseJson<SchemaField[]>(row.examinee_fields, []),
  questions: parseJson<Question[]>(row.questions, []),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toSummary = (row: SummaryRow): QuizSummary => {
  const questions = parseJson<Question[]>(row.questions, []);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    accessMode: row.access_mode,
    shareToken: row.share_token,
    questionCount: questions.length,
    submissionCount: row.submission_count,
    averageScore: row.average_score,
    maxScore: questions.reduce((sum, q) => sum + q.points, 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export interface QuizRepository {
  listByOwner(ownerId: string): QuizSummary[];
  findById(id: string): Quiz | null;
  findByToken(token: string): Quiz | null;
  insert(quiz: Quiz): void;
  update(quiz: Quiz): void;
  delete(id: string): void;
}

export function createQuizRepository(db: Db): QuizRepository {
  const SUMMARY_SQL = `
    SELECT q.*,
      (SELECT COUNT(*) FROM submissions s WHERE s.quiz_id = q.id) AS submission_count,
      (SELECT AVG(score) FROM submissions s WHERE s.quiz_id = q.id) AS average_score
    FROM quizzes q WHERE q.owner_id = ? ORDER BY q.updated_at DESC`;

  return {
    listByOwner(ownerId) {
      return (db.prepare(SUMMARY_SQL).all(ownerId) as unknown as SummaryRow[]).map(toSummary);
    },
    findById(id) {
      const row = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(id) as QuizRow | undefined;
      return row ? toQuiz(row) : null;
    },
    findByToken(token) {
      const row = db.prepare('SELECT * FROM quizzes WHERE share_token = ?').get(token) as QuizRow | undefined;
      return row ? toQuiz(row) : null;
    },
    insert(q) {
      db.prepare(
        `INSERT INTO quizzes (id, owner_id, title, description, status, access_mode, share_token, duration_seconds,
          reveal_answers, reveal_scores, leaderboard_visible, examinee_fields, questions, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        q.id,
        q.ownerId,
        q.title,
        q.description,
        q.status,
        q.accessMode,
        q.shareToken,
        q.durationSeconds,
        q.revealAnswers ? 1 : 0,
        q.revealScores ? 1 : 0,
        q.leaderboardVisible ? 1 : 0,
        JSON.stringify(q.examineeFields),
        JSON.stringify(q.questions),
        q.createdAt,
        q.updatedAt,
      );
    },
    update(q) {
      db.prepare(
        `UPDATE quizzes SET title = ?, description = ?, status = ?, access_mode = ?, share_token = ?,
          duration_seconds = ?, reveal_answers = ?, reveal_scores = ?, leaderboard_visible = ?, examinee_fields = ?, questions = ?,
          updated_at = ? WHERE id = ?`,
      ).run(
        q.title,
        q.description,
        q.status,
        q.accessMode,
        q.shareToken,
        q.durationSeconds,
        q.revealAnswers ? 1 : 0,
        q.revealScores ? 1 : 0,
        q.leaderboardVisible ? 1 : 0,
        JSON.stringify(q.examineeFields),
        JSON.stringify(q.questions),
        q.updatedAt,
        q.id,
      );
    },
    delete(id) {
      db.prepare('DELETE FROM quizzes WHERE id = ?').run(id);
    },
  };
}
