import type { Db } from '@/services/database';
import { openDatabase } from '@/services/database';
import { env } from '@/config/env';
import { createAuthRepository, createAuthService, type AuthService } from '@/modules/auth';
import {
  createQuizRepository,
  createQuizService,
  createAttemptRepository,
  createAttemptService,
  type QuizService,
  type AttemptService,
  type AttemptRepository,
  createSubmissionService,
  StandardGradingStrategy,
  type SubmissionService,
} from '@/modules/quiz';
import { createEventBus, type EventBus } from '@/services/event-bus';
import { createProctorService, type ProctorService } from '@/modules/proctor';
import { createLeaderboardService, ScoreDurationTimestampStrategy, type LeaderboardService } from '@/modules/leaderboard';
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
  attemptRepo: AttemptRepository;
  attempts: AttemptService;
  submissions: SubmissionService;
  events: EventBus;
  proctor: ProctorService;
  leaderboard: LeaderboardService;
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

  const attemptRepo = createAttemptRepository(db);
  const attempts = createAttemptService(attemptRepo);
  const events = createEventBus();
  const submissions = createSubmissionService({ db, repo: attemptRepo, grading: new StandardGradingStrategy(), events });

  const proctor = createProctorService(attemptRepo, events);

  const leaderboard = createLeaderboardService({
    quizzes,
    attempts: attemptRepo,
    strategy: new ScoreDurationTimestampStrategy(),
    events,
  });

  return { db, auth, quizzes, share, attemptRepo, attempts, submissions, events, proctor, leaderboard };
}
