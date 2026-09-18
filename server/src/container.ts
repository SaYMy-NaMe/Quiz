import type { Db } from '@/services/database';
import { openDatabase } from '@/services/database';
import { env } from '@/config/env';
import { createAuthRepository, createAuthService, type AuthService } from '@/modules/auth';
import { createQuizRepository, createQuizService, type QuizService } from '@/modules/quiz';
import {
  createTokenService,
  createInviteRepository,
  createAccessStrategies,
  createShareService,
  type ShareService,
} from '@/modules/share';

/**
 * Dependency-injection container. Every module exposes a `create*` factory that
 * receives its collaborators explicitly; nothing reaches for globals.
 */
export interface Container {
  db: Db;
  auth: AuthService;
  quizzes: QuizService;
  share: ShareService;
}

export function createContainer(overrides: { db?: Db } = {}): Container {
  const db = overrides.db ?? openDatabase();
  const tokens = createTokenService();

  const auth = createAuthService({
    repo: createAuthRepository(db),
    sessionTtlHours: env.SESSION_TTL_HOURS,
    bcryptRounds: env.NODE_ENV === 'test' ? 4 : 10,
  });
  const quizzes = createQuizService({ repo: createQuizRepository(db), tokens });
  const invites = createInviteRepository(db);
  const share = createShareService({ quizzes, invites, strategies: createAccessStrategies(invites), tokens });

  return { db, auth, quizzes, share };
}
