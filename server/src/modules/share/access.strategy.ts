import type { Quiz } from '@shared';
import type { InviteRepository } from './invite.repository';

export interface AccessContext {
  quiz: Quiz;
  /** Invite token supplied via `?invite=` on restricted links. */
  inviteToken?: string | undefined;
}

export type AccessDecision =
  | { allowed: true; lockedEmail?: string }
  | { allowed: false; reason: 'no_invite' | 'invalid_invite' };

/**
 * Strategy Pattern: each access mode owns its own authorisation rule. The
 * share service picks the strategy from `quiz.accessMode` and never branches
 * on the mode itself.
 */
export interface AccessStrategy {
  readonly mode: Quiz['accessMode'];
  authorize(ctx: AccessContext): Promise<AccessDecision>;
}

export class PublicAccessStrategy implements AccessStrategy {
  readonly mode = 'public' as const;
  authorize(): Promise<AccessDecision> {
    return Promise.resolve({ allowed: true });
  }
}

export class RestrictedAccessStrategy implements AccessStrategy {
  readonly mode = 'restricted' as const;
  constructor(private readonly invites: InviteRepository) {}

  async authorize({ quiz, inviteToken }: AccessContext): Promise<AccessDecision> {
    if (!inviteToken) return { allowed: false, reason: 'no_invite' };
    const invite = await this.invites.findByToken(inviteToken);
    if (invite?.quizId !== quiz.id) return { allowed: false, reason: 'invalid_invite' };
    return { allowed: true, lockedEmail: invite.email };
  }
}

export type AccessStrategyRegistry = Record<Quiz['accessMode'], AccessStrategy>;

export function createAccessStrategies(invites: InviteRepository): AccessStrategyRegistry {
  return {
    public: new PublicAccessStrategy(),
    restricted: new RestrictedAccessStrategy(invites),
  };
}
