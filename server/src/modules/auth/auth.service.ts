import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import type { Instructor, Credentials, RegisterPayload } from '@shared';
import type { AuthRepository } from './auth.repository';
import { conflict, unauthorized } from '@/utils/errors';
import { newId } from '@/utils/ids';
import { nowIso, addSeconds } from '@/utils/time';

export interface IssuedSession {
  instructor: Instructor;
  sessionId: string;
  expiresAt: string;
}

export interface AuthService {
  register(payload: RegisterPayload): Promise<IssuedSession>;
  login(credentials: Credentials): Promise<IssuedSession>;
  logout(sessionId: string): Promise<void>;
  resolveSession(sessionId: string): Promise<Instructor | null>;
  purgeExpiredSessions(): Promise<void>;
}

interface AuthServiceDeps {
  repo: AuthRepository;
  sessionTtlHours: number;
  bcryptRounds?: number;
}

const strip = ({ id, email, name, createdAt }: Instructor & { passwordHash?: string }): Instructor => ({ id, email, name, createdAt });

export function createAuthService({ repo, sessionTtlHours, bcryptRounds = 10 }: AuthServiceDeps): AuthService {
  const issueSession = async (instructorId: string) => {
    const createdAt = nowIso();
    const expiresAt = addSeconds(createdAt, sessionTtlHours * 3600);
    // 32 chars of URL-safe alphabet => ~190 bits; unguessable session identifiers.
    const sessionId = nanoid(32);
    await repo.createSession({ id: sessionId, instructorId, expiresAt, createdAt });
    return { sessionId, expiresAt };
  };

  return {
    async register({ email, password, name }) {
      const normalized = email.trim().toLowerCase();
      if (await repo.findByEmail(normalized)) throw conflict('An account with this email already exists');
      const id = newId();
      await repo.create({ id, email: normalized, name: name.trim(), passwordHash: bcrypt.hashSync(password, bcryptRounds), createdAt: nowIso() });
      const instructor = await repo.findById(id);
      if (!instructor) throw new Error('Instructor creation failed');
      return { instructor: strip(instructor), ...(await issueSession(id)) };
    },

    async login({ email, password }) {
      const instructor = await repo.findByEmail(email.trim().toLowerCase());
      // Compare against a dummy hash when the user is unknown to keep timing uniform.
      const hash = instructor?.passwordHash ?? '$2a$10$CwTycUXWue0Thq9StjUM0uJ8i0pO1ZlZ2V1oLqZvQ1YhE7v5lQb3a';
      const ok = bcrypt.compareSync(password, hash);
      if (!instructor || !ok) throw unauthorized('Invalid email or password');
      return { instructor: strip(instructor), ...(await issueSession(instructor.id)) };
    },

    logout: (sessionId) => repo.deleteSession(sessionId),
    purgeExpiredSessions: () => repo.purgeExpiredSessions(nowIso()),

    async resolveSession(sessionId) {
      const session = await repo.findSession(sessionId);
      if (!session) return null;
      if (session.expiresAt < nowIso()) {
        await repo.deleteSession(sessionId);
        return null;
      }
      const instructor = await repo.findById(session.instructorId);
      return instructor ? strip(instructor) : null;
    },
  };
}
