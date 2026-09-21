import type { QuizStatus } from '@shared';
import { conflict } from '@/utils/errors';

/**
 * Quiz lifecycle:  Draft ──publish──▶ Published ──close──▶ Closed
 *                    ▲                   │                    │
 *                    └────unpublish──────┘        reopen──────┘
 * Edits are only allowed in Draft; attempts only in Published.
 */
const TRANSITIONS: Record<QuizStatus, Partial<Record<'publish' | 'unpublish' | 'close' | 'reopen', QuizStatus>>> = {
  draft: { publish: 'published' },
  published: { unpublish: 'draft', close: 'closed' },
  closed: { reopen: 'published' },
};

export type QuizAction = keyof (typeof TRANSITIONS)[QuizStatus];

export function transition(from: QuizStatus, action: QuizAction): QuizStatus {
  const to = TRANSITIONS[from][action];
  if (!to) throw conflict(`Cannot ${action} a quiz that is ${from}`);
  return to;
}

export const isEditable = (status: QuizStatus): boolean => status === 'draft';
export const acceptsAttempts = (status: QuizStatus): boolean => status === 'published';
