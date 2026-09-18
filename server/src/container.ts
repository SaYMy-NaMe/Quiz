import { nanoid } from 'nanoid';
import type { Db } from '@/services/database';
import { openDatabase } from '@/services/database';
import { env } from '@/config/env';
import { SHARE_TOKEN_LENGTH } from '@shared';
import { createAuthRepository, createAuthService, type AuthService } from '@/modules/auth';
import { createQuizRepository, createQuizService, type QuizService } from '@/modules/quiz';

/**
 * Dependency-injection container. Every module exposes a `create*` factory that
 * receives its collaborators explicitly; nothing reaches for globals.
 */
export interface Container {
  db: Db;
  auth: AuthService;
  quizzes: QuizService;
}

export function createContainer(overrides: { db?: Db } = {}): Container {
  const db = overrides.db ?? openDatabase();
  const auth = createAuthService({
    repo: createAuthRepository(db),
    sessionTtlHours: env.SESSION_TTL_HOURS,
    bcryptRounds: env.NODE_ENV === 'test' ? 4 : 10,
  });
  const quizzes = createQuizService({
    repo: createQuizRepository(db),
    tokens: { issueShareToken: () => nanoid(SHARE_TOKEN_LENGTH) },
  });
  return { db, auth, quizzes };
}
