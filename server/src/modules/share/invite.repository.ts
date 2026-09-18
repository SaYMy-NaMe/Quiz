import type { Db } from '@/services/database';

export interface Invite {
  id: string;
  quizId: string;
  email: string;
  token: string;
  createdAt: string;
}

interface InviteRow {
  id: string;
  quiz_id: string;
  email: string;
  token: string;
  created_at: string;
}

const toInvite = (r: InviteRow): Invite => ({
  id: r.id,
  quizId: r.quiz_id,
  email: r.email,
  token: r.token,
  createdAt: r.created_at,
});

export interface InviteRepository {
  listByQuiz(quizId: string): Invite[];
  findByToken(token: string): Invite | null;
  findByQuizAndEmail(quizId: string, email: string): Invite | null;
  insert(invite: Invite): void;
  delete(quizId: string, inviteId: string): boolean;
}

export function createInviteRepository(db: Db): InviteRepository {
  return {
    listByQuiz(quizId) {
      return (db.prepare('SELECT * FROM invites WHERE quiz_id = ? ORDER BY created_at ASC').all(quizId) as unknown as InviteRow[]).map(toInvite);
    },
    findByToken(token) {
      const row = db.prepare('SELECT * FROM invites WHERE token = ?').get(token) as InviteRow | undefined;
      return row ? toInvite(row) : null;
    },
    findByQuizAndEmail(quizId, email) {
      const row = db.prepare('SELECT * FROM invites WHERE quiz_id = ? AND email = ?').get(quizId, email) as InviteRow | undefined;
      return row ? toInvite(row) : null;
    },
    insert(i) {
      db.prepare('INSERT INTO invites (id, quiz_id, email, token, created_at) VALUES (?, ?, ?, ?, ?)').run(
        i.id, i.quizId, i.email, i.token, i.createdAt,
      );
    },
    delete(quizId, inviteId) {
      const result = db.prepare('DELETE FROM invites WHERE quiz_id = ? AND id = ?').run(quizId, inviteId);
      return Number(result.changes) > 0;
    },
  };
}
