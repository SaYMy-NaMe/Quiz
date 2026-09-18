import type { PublicQuiz, Quiz } from '@shared';
import type { QuizService } from '@/modules/quiz';
import { stateOf } from '@/modules/quiz';
import type { InviteRepository, Invite } from './invite.repository';
import type { AccessStrategyRegistry } from './access.strategy';
import type { TokenService } from './token.service';
import { notFound } from '@/utils/errors';
import { newId } from '@/utils/ids';
import { nowIso } from '@/utils/time';

export interface ResolvedShare {
  quiz: Quiz;
  lockedEmail?: string | undefined;
}

export interface ShareService {
  /**
   * Resolves a share token to a quiz. Throws a uniform 404 for unknown tokens,
   * unauthorised restricted access and quizzes not accepting attempts so the
   * response never leaks whether a token exists.
   */
  resolve(token: string, inviteToken?: string): ResolvedShare;
  toPublicQuiz(resolved: ResolvedShare): PublicQuiz;
  listInvites(ownerId: string, quizId: string): Invite[];
  addInvites(ownerId: string, quizId: string, emails: string[]): Invite[];
  removeInvite(ownerId: string, quizId: string, inviteId: string): void;
}

interface Deps {
  quizzes: QuizService;
  invites: InviteRepository;
  strategies: AccessStrategyRegistry;
  tokens: TokenService;
}

export function createShareService({ quizzes, invites, strategies, tokens }: Deps): ShareService {
  return {
    resolve(token, inviteToken) {
      if (!tokens.isWellFormed(token)) throw notFound();
      const quiz = quizzes.findByToken(token);
      if (!quiz || !stateOf(quiz).acceptsAttempts) throw notFound();
      const decision = strategies[quiz.accessMode].authorize({ quiz, inviteToken });
      if (!decision.allowed) throw notFound();
      return { quiz, lockedEmail: decision.lockedEmail };
    },

    toPublicQuiz({ quiz, lockedEmail }) {
      const pub: PublicQuiz = {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        durationSeconds: quiz.durationSeconds,
        accessMode: quiz.accessMode,
        examineeFields: quiz.examineeFields,
        questionCount: quiz.questions.length,
      };
      if (lockedEmail) pub.lockedEmail = lockedEmail;
      return pub;
    },

    listInvites(ownerId, quizId) {
      quizzes.get(ownerId, quizId);
      return invites.listByQuiz(quizId);
    },

    addInvites(ownerId, quizId, emails) {
      quizzes.get(ownerId, quizId);
      const created: Invite[] = [];
      for (const raw of emails) {
        const email = raw.trim().toLowerCase();
        if (!email) continue;
        const existing = invites.findByQuizAndEmail(quizId, email);
        if (existing) {
          created.push(existing);
          continue;
        }
        const invite: Invite = { id: newId(), quizId, email, token: tokens.issueInviteToken(), createdAt: nowIso() };
        invites.insert(invite);
        created.push(invite);
      }
      return created;
    },

    removeInvite(ownerId, quizId, inviteId) {
      quizzes.get(ownerId, quizId);
      if (!invites.delete(quizId, inviteId)) throw notFound('Invite not found');
    },
  };
}
