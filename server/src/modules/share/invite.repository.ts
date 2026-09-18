import type { Db } from '@/db/prisma';
import type { Invite as InviteRow } from '@prisma/client';

export interface Invite {
  id: string;
  quizId: string;
  email: string;
  token: string;
  createdAt: string;
}

const toInvite = (r: InviteRow): Invite => ({
  id: r.id,
  quizId: r.quizId,
  email: r.email,
  token: r.token,
  createdAt: r.createdAt.toISOString(),
});

export interface InviteRepository {
  listByQuiz(quizId: string): Promise<Invite[]>;
  findByToken(token: string): Promise<Invite | null>;
  findByQuizAndEmail(quizId: string, email: string): Promise<Invite | null>;
  insert(invite: Invite): Promise<void>;
  delete(quizId: string, inviteId: string): Promise<boolean>;
}

export function createInviteRepository(db: Db): InviteRepository {
  return {
    async listByQuiz(quizId) {
      return (await db.invite.findMany({ where: { quizId }, orderBy: { createdAt: 'asc' } })).map(toInvite);
    },
    async findByToken(token) {
      const row = await db.invite.findUnique({ where: { token } });
      return row ? toInvite(row) : null;
    },
    async findByQuizAndEmail(quizId, email) {
      const row = await db.invite.findUnique({ where: { quizId_email: { quizId, email } } });
      return row ? toInvite(row) : null;
    },
    async insert(i) {
      await db.invite.create({ data: { id: i.id, quizId: i.quizId, email: i.email, token: i.token, createdAt: new Date(i.createdAt) } });
    },
    async delete(quizId, inviteId) {
      const result = await db.invite.deleteMany({ where: { id: inviteId, quizId } });
      return result.count > 0;
    },
  };
}
