import type { Quiz, QuizStatus } from '@shared';
import { conflict } from '@/utils/errors';

/**
 * State Pattern: the quiz lifecycle is modelled as explicit state objects so
 * transition rules live in one place instead of scattered `if (status === …)`.
 *
 *   Draft ──publish──▶ Published ──close──▶ Closed
 *     ▲                   │                    │
 *     └────unpublish──────┘        reopen──────┘
 */
export interface QuizState {
  readonly name: QuizStatus;
  /** Whether instructors can mutate questions/settings in this state. */
  readonly editable: boolean;
  /** Whether examinees may start attempts in this state. */
  readonly acceptsAttempts: boolean;
  publish(quiz: Quiz, issueToken: () => string): Quiz;
  unpublish(quiz: Quiz): Quiz;
  close(quiz: Quiz): Quiz;
  reopen(quiz: Quiz): Quiz;
}

const invalid = (from: QuizStatus, action: string) => conflict(`Cannot ${action} a quiz that is ${from}`);

class DraftState implements QuizState {
  readonly name = 'draft' as const;
  readonly editable = true;
  readonly acceptsAttempts = false;
  publish(quiz: Quiz, issueToken: () => string): Quiz {
    if (quiz.questions.length === 0) throw conflict('Add at least one question before publishing');
    return { ...quiz, status: 'published', shareToken: quiz.shareToken ?? issueToken() };
  }
  unpublish(): never {
    throw invalid('draft', 'unpublish');
  }
  close(): never {
    throw invalid('draft', 'close');
  }
  reopen(): never {
    throw invalid('draft', 'reopen');
  }
}

class PublishedState implements QuizState {
  readonly name = 'published' as const;
  readonly editable = false;
  readonly acceptsAttempts = true;
  publish(): never {
    throw invalid('published', 'publish');
  }
  unpublish(quiz: Quiz): Quiz {
    return { ...quiz, status: 'draft' };
  }
  close(quiz: Quiz): Quiz {
    return { ...quiz, status: 'closed' };
  }
  reopen(): never {
    throw invalid('published', 'reopen');
  }
}

class ClosedState implements QuizState {
  readonly name = 'closed' as const;
  readonly editable = false;
  readonly acceptsAttempts = false;
  publish(): never {
    throw invalid('closed', 'publish');
  }
  unpublish(): never {
    throw invalid('closed', 'unpublish');
  }
  close(): never {
    throw invalid('closed', 'close');
  }
  reopen(quiz: Quiz): Quiz {
    return { ...quiz, status: 'published' };
  }
}

const STATES: Record<QuizStatus, QuizState> = {
  draft: new DraftState(),
  published: new PublishedState(),
  closed: new ClosedState(),
};

export const stateOf = (quiz: Pick<Quiz, 'status'>): QuizState => STATES[quiz.status];
