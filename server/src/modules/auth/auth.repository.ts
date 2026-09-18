import type { Db } from '@/db/prisma';
import type { Instructor } from '@shared';

export interface InstructorWithHash extends Instructor {
  passwordHash: string;
}

export interface SessionRecord {
  id: string;
  instructorId: string;
  expiresAt: string;
}

const toInstructor = (row: { id: string; email: string; name: string; passwordHash: string; createdAt: Date }): InstructorWithHash => ({
  id: row.id,
  email: row.email,
  name: row.name,
  createdAt: row.createdAt.toISOString(),
  passwordHash: row.passwordHash,
});

export interface AuthRepository {
  findByEmail(email: string): Promise<InstructorWithHash | null>;
  findById(id: string): Promise<InstructorWithHash | null>;
  create(input: { id: string; email: string; name: string; passwordHash: string; createdAt: string }): Promise<void>;
  createSession(input: { id: string; instructorId: string; expiresAt: string; createdAt: string }): Promise<void>;
  findSession(id: string): Promise<SessionRecord | null>;
  deleteSession(id: string): Promise<void>;
  purgeExpiredSessions(nowIso: string): Promise<void>;
}

export function createAuthRepository(db: Db): AuthRepository {
  return {
    async findByEmail(email) {
      const row = await db.instructor.findUnique({ where: { email } });
      return row ? toInstructor(row) : null;
    },
    async findById(id) {
      const row = await db.instructor.findUnique({ where: { id } });
      return row ? toInstructor(row) : null;
    },
    async create({ id, email, name, passwordHash, createdAt }) {
      await db.instructor.create({ data: { id, email, name, passwordHash, createdAt: new Date(createdAt) } });
    },
    async createSession({ id, instructorId, expiresAt, createdAt }) {
      await db.session.create({ data: { id, instructorId, expiresAt: new Date(expiresAt), createdAt: new Date(createdAt) } });
    },
    async findSession(id) {
      const row = await db.session.findUnique({ where: { id } });
      return row ? { id: row.id, instructorId: row.instructorId, expiresAt: row.expiresAt.toISOString() } : null;
    },
    async deleteSession(id) {
      await db.session.deleteMany({ where: { id } });
    },
    async purgeExpiredSessions(now) {
      await db.session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
    },
  };
}
