import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import type { Instructor, Credentials, RegisterPayload } from '@shared';
import type { AuthRepository } from './auth.repository';
import { conflict, unauthorized } from '@/utils/errors';
import { newId } from '@/utils/ids';
import { nowIso, addSeconds } from '@/utils/time';

export interface AuthService {
  register(payload: RegisterPayload): { instructor: Instructor; sessionId: string; expiresAt: string };
  login(credentials: Credentials): { instructor: Instructor; sessionId: string; expiresAt: string };
  logout(sessionId: string): void;
  resolveSession(sessionId: string): Instructor | null;
  purgeExpiredSessions(): void;
}

interface AuthServiceDeps {
  repo: AuthRepository;
  sessionTtlHours: number;
  bcryptRounds?: number;
}

const strip = ({ id, email, name, createdAt }: Instructor & { passwordHash?: string }): Instructor => ({
  id,
  email,
  name,
  createdAt,
});

export function createAuthService({ repo, sessionTtlHours, bcryptRounds = 10 }: AuthServiceDeps): AuthService {
  const issueSession = (instructorId: string) => {
    const createdAt = nowIso();
    const expiresAt = addSeconds(createdAt, sessionTtlHours * 3600);
    // 32 chars of URL-safe alphabet => ~190 bits; unguessable session identifiers.
    const sessionId = nanoid(32);
    repo.createSession({ id: sessionId, instructorId, expiresAt, createdAt });
    return { sessionId, expiresAt };
  };

  return {
    register({ email, password, name }) {
      const normalized = email.trim().toLowerCase();
      if (repo.findByEmail(normalized)) throw conflict('An account with this email already exists');
      const id = newId();
      repo.create({
        id,
        email: normalized,
        name: name.trim(),
        passwordHash: bcrypt.hashSync(password, bcryptRounds),
        createdAt: nowIso(),
      });
      const instructor = repo.findById(id);
      if (!instructor) throw new Error('Instructor creation failed');
      return { instructor: strip(instructor), ...issueSession(id) };
    },

    login({ email, password }) {
      const instructor = repo.findByEmail(email.trim().toLowerCase());
      // Compare against a dummy hash when the user is unknown to keep timing uniform.
      const hash = instructor?.passwordHash ?? '$2a$10$CwTycUXWue0Thq9StjUM0uJ8i0pO1ZlZ2V1oLqZvQ1YhE7v5lQb3a';
      const ok = bcrypt.compareSync(password, hash);
      if (!instructor || !ok) throw unauthorized('Invalid email or password');
      return { instructor: strip(instructor), ...issueSession(instructor.id) };
    },

    logout(sessionId) {
      repo.deleteSession(sessionId);
    },

    purgeExpiredSessions() {
      repo.purgeExpiredSessions(nowIso());
    },

    resolveSession(sessionId) {
      const session = repo.findSession(sessionId);
      if (!session) return null;
      if (session.expires_at < nowIso()) {
        repo.deleteSession(sessionId);
        return null;
      }
      const instructor = repo.findById(session.instructor_id);
      return instructor ? strip(instructor) : null;
    },
  };
}
