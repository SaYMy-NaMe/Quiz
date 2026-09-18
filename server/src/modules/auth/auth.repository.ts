import type { Db } from '@/services/database';
import type { Instructor } from '@shared';

interface InstructorRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}

interface SessionRow {
  id: string;
  instructor_id: string;
  expires_at: string;
}

export interface InstructorWithHash extends Instructor {
  passwordHash: string;
}

const toInstructor = (row: InstructorRow): InstructorWithHash => ({
  id: row.id,
  email: row.email,
  name: row.name,
  createdAt: row.created_at,
  passwordHash: row.password_hash,
});

export interface AuthRepository {
  findByEmail(email: string): InstructorWithHash | null;
  findById(id: string): InstructorWithHash | null;
  create(input: { id: string; email: string; name: string; passwordHash: string; createdAt: string }): void;
  createSession(input: { id: string; instructorId: string; expiresAt: string; createdAt: string }): void;
  findSession(id: string): SessionRow | null;
  deleteSession(id: string): void;
  purgeExpiredSessions(nowIso: string): void;
}

export function createAuthRepository(db: Db): AuthRepository {
  return {
    findByEmail(email) {
      const row = db.prepare('SELECT * FROM instructors WHERE email = ?').get(email) as InstructorRow | undefined;
      return row ? toInstructor(row) : null;
    },
    findById(id) {
      const row = db.prepare('SELECT * FROM instructors WHERE id = ?').get(id) as InstructorRow | undefined;
      return row ? toInstructor(row) : null;
    },
    create({ id, email, name, passwordHash, createdAt }) {
      db.prepare(
        'INSERT INTO instructors (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(id, email, name, passwordHash, createdAt);
    },
    createSession({ id, instructorId, expiresAt, createdAt }) {
      db.prepare('INSERT INTO sessions (id, instructor_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
        id,
        instructorId,
        expiresAt,
        createdAt,
      );
    },
    findSession(id) {
      return (db.prepare('SELECT id, instructor_id, expires_at FROM sessions WHERE id = ?').get(id) as
        | SessionRow
        | undefined) ?? null;
    },
    deleteSession(id) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    },
    purgeExpiredSessions(now) {
      db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
    },
  };
}
