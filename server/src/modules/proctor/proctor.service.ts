import { VIOLATION_THRESHOLD } from '@shared';
import type { ResolvedShare } from '@/modules/share';
import type { AttemptRepository } from '@/modules/quiz';
import type { EventBus } from '@/services/event-bus';
import { notFound } from '@/utils/errors';
import { newId } from '@/utils/ids';
import { nowIso } from '@/utils/time';

export type ViolationKind = 'visibility' | 'blur' | 'fullscreen-exit' | 'shortcut' | 'contextmenu';

export interface ViolationReport {
  violations: number;
  threshold: number;
  /** True when the client must submit immediately. */
  shouldSubmit: boolean;
}

export interface ProctorService {
  record(share: ResolvedShare, attemptId: string, kind: ViolationKind): ViolationReport;
}

export function createProctorService(repo: AttemptRepository, events: EventBus): ProctorService {
  return {
    record({ quiz }, attemptId, kind) {
      const attempt = repo.findAttempt(attemptId);
      if (!attempt || attempt.quizId !== quiz.id) throw notFound('Attempt not found');
      if (attempt.status === 'submitted') {
        return { violations: attempt.violations, threshold: VIOLATION_THRESHOLD, shouldSubmit: false };
      }
      const violations = repo.incrementViolations(attempt.id, kind, nowIso(), newId());
      events.emit('attempt:violation', { attemptId: attempt.id, quizId: quiz.id, violations, kind });
      return { violations, threshold: VIOLATION_THRESHOLD, shouldSubmit: violations >= VIOLATION_THRESHOLD };
    },
  };
}
