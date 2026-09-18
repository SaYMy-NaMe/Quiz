import { EventEmitter } from 'node:events';
import type { Submission } from '@shared';

/**
 * Observer Pattern: domain events decouple the submission pipeline from
 * consumers (leaderboard cache invalidation, audit logging, future webhooks).
 */
export interface DomainEvents {
  'submission:created': (submission: Submission) => void;
  'attempt:violation': (payload: { attemptId: string; quizId: string; violations: number; kind: string }) => void;
}

export interface EventBus {
  on<K extends keyof DomainEvents>(event: K, listener: DomainEvents[K]): () => void;
  emit<K extends keyof DomainEvents>(event: K, ...args: Parameters<DomainEvents[K]>): void;
}

export function createEventBus(): EventBus {
  const emitter = new EventEmitter({ captureRejections: false });
  emitter.setMaxListeners(50);
  return {
    on(event, listener) {
      emitter.on(event, listener as (...args: unknown[]) => void);
      return () => emitter.off(event, listener as (...args: unknown[]) => void);
    },
    emit(event, ...args) {
      emitter.emit(event, ...args);
    },
  };
}
